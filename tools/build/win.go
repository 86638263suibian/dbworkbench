package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

func s3SetupPathWin() string {
	return s3Dir + fmt.Sprintf("rel/dbHero--setup-%s.exe", programVersion)
}

func s3SetupPathWinCef() string {
	return s3Dir + fmt.Sprintf("rel/dbHero-cef-setup-%s.exe", programVersion)
}

func s3SetupPathWinBeta() string {
	return s3Dir + fmt.Sprintf("beta/dbHero-setup-%s.exe", programVersion)
}

func s3SetupPathWinCefBeta() string {
	return s3Dir + fmt.Sprintf("beta/dbHero-cef-setup-%s.exe", programVersion)
}

func exeSetupPath() string {
	exeName := fmt.Sprintf("dbHero-setup-%s.exe", programVersion)
	return pj("bin", "Release", exeName)
}

func exeSetupTmpPath() string {
	return pj("bin", "Release", "dbHero-setup-inno.exe")
}

func exePath() string {
	return pj("bin", "Release", "dbHero.exe")
}

// http://zabkat.com/blog/code-signing-sha1-armageddon.htm
// signtool sign /n "subject name" /t http://timestamp.comodoca.com/authenticode myInstaller.exe
// signtool sign /n "subject name" /fd sha256 /tr http://timestamp.comodoca.com/rfc3161 /td sha256 /as myInstaller.exe
// signtool args (https://msdn.microsoft.com/en-us/library/windows/desktop/aa387764(v=vs.85).aspx):
//   /as          : append signature
//   /fd ${alg}   : specify digest algo, default is sha1
//   /t ${url}    : timestamp server
//   /tr ${url}   : timestamp rfc 3161 server
//   /td ${alg}   : for /tr, must be after /tr
//   /du ${url}   : URL for expanded description of the signed content.
func signMust(path string) {
	// signtool is finicky so we copy cert.pfx to the directory where the file is
	fileDir := filepath.Dir(path)
	fileName := filepath.Base(path)
	certPwd := cachedSecrets.CertPwd
	certDest := pj(fileDir, "cert.pfx")
	fileCopyMust(certDest, certPath)
	cmd := getCmdInEnv(getEnvForVS(), "signtool.exe", "sign", "/t", "http://timestamp.verisign.com/scripts/timstamp.dll",
		"/du", "http://dbheroapp.com", "/f", "cert.pfx",
		"/p", certPwd, fileName)
	cmd.Dir = fileDir
	runCmdMust(cmd, true)

	// double-sign with sha2 for win7+ ater Jan 2016
	cmd = getCmdInEnv(getEnvForVS(), "signtool.exe", "sign", "/fd", "sha256", "/tr", "http://timestamp.comodoca.com/rfc3161",
		"/td", "sha256", "/du", "http://dbheroapp.com", "/f", "cert.pfx",
		"/p", certPwd, "/as", fileName)
	cmd.Dir = fileDir
	runCmdMust(cmd, true)
}

func detectInnoSetupMust() {
	path1 := pj(os.Getenv("ProgramFiles"), "Inno Setup 5", "iscc.exe")
	if fileExists(path1) {
		innoSetupPath = path1
		fmt.Printf("Inno Setup: %s\n", innoSetupPath)
		return
	}
	path2 := pj(os.Getenv("ProgramFiles(x86)"), "Inno Setup 5", "iscc.exe")
	if fileExists(path2) {
		innoSetupPath = path2
		fmt.Printf("Inno Setup: %s\n", innoSetupPath)
		return
	}
	fatalif(true, "didn't find Inno Setup (tried '%s' and '%s'). Download from http://www.jrsoftware.org/isinfo.php\n", path1, path2)
}

func cleanWin() {
	removeDirMust("obj")
	removeDirMust("bin")
}

var (
	winDir    string
	winCefDir string
)

func rememberDirs() {
	var err error
	winDir, err = filepath.Abs(filepath.Join("win", "dbhero"))
	fataliferr(err)
	winCefDir, err = filepath.Abs(filepath.Join("win-cef", "dbhero"))
	fataliferr(err)
}

func cdToWinDir() {
	err := os.Chdir(winDir)
	fataliferr(err)
}

func cdToWinCefDir() {
	err := os.Chdir(winCefDir)
	fataliferr(err)
}

func buildWin() {
	if flgUpload {
		s3VerifyNotExistsMust(s3SetupPathWin())
	}
	cdToWinDir()
	cleanWin()

	out, err := runMsbuildGetOutput(true, "DBHero.csproj", "/t:Rebuild", "/p:Configuration=Release", "/m")
	if err != nil {
		fmt.Printf("failed with:\n%s\n", string(out))
	}
	fataliferr(err)
}

func nugetRestore() {
	httpDlToFileMust("https://dist.nuget.org/win-x86-commandline/v3.3.0/nuget.exe", "nuget.exe", "56de2b3f051ef6d114ad71ece4ceb5330fe44e0e")
	cmd := exec.Command("nuget", "restore")
	fmt.Printf("Running %s\n", cmd.Args)
	runCmdMust(cmd, true)
}

func buildWinCef() {
	if flgUpload {
		s3VerifyNotExistsMust(s3SetupPathWinCef())
	}
	cdToWinCefDir()
	cleanWin()

	nugetRestore()

	out, err := runMsbuildGetOutput(true, "DBHero.sln", "/t:Rebuild", "/p:Configuration=Release", "/m")
	if err != nil {
		fmt.Printf("failed with:\n%s\n", string(out))
	}
	fataliferr(err)
}

func buildSetupWin() {
	signMust(exePath())
	signMust("dbherohelper.exe")

	// only for cef build
	path := pj("bin", "Release", "CefSharp.BrowserSubprocess.exe")
	if fileExists(path) {
		signMust(path)
	}

	ver := fmt.Sprintf("/dMyAppVersion=%s", programVersion)
	cmd := exec.Command(innoSetupPath, "/Qp", ver, "installer.iss")
	fmt.Printf("Running %s\n", cmd.Args)
	runCmdMust(cmd, true)
	signMust(exeSetupTmpPath())
	fileCopyMust(exeSetupPath(), exeSetupTmpPath())
}

func uploadToS3Win() {
	if !flgUpload {
		fmt.Printf("skipping s3 upload because -upload not given\n")
		return
	}

	s3Path := ""

	cdToWinDir()
	s3Path = s3SetupPathWin()
	s3VerifyNotExistsMust(s3Path)
	s3UploadFileMust(s3Path, exeSetupPath(), true)

	cdToWinCefDir()
	s3Path = s3SetupPathWinCef()
	s3VerifyNotExistsMust(s3Path)
	s3UploadFileMust(s3Path, exeSetupPath(), true)

	// for now we use non-cef version
	s3Path = s3SetupPathWin()

	s3Url := "https://kjkpub.s3.amazonaws.com/" + s3Path
	buildOn := time.Now().Format("2006-01-02")
	jsTxt := fmt.Sprintf(`var LatestVerWin = "%s";
var LatestUrlWin = "%s";
var BuiltOnWin = "%s";
`, programVersion, s3Url, buildOn)
	s3UploadString(s3Dir+"latestverwin.js", jsTxt, true)
	s3VerifyExistsWaitMust(s3Path)
}

func uploadToS3WinBeta() {
	if !flgUpload {
		fmt.Printf("skipping s3 upload because -upload not given\n")
		return
	}

	s3Path := ""

	cdToWinDir()
	s3Path = s3SetupPathWinBeta()
	s3VerifyNotExistsMust(s3Path)
	s3UploadFileMust(s3Path, exeSetupPath(), true)

	cdToWinCefDir()
	s3Path = s3SetupPathWinCefBeta()
	s3VerifyNotExistsMust(s3Path)
	s3UploadFileMust(s3Path, exeSetupPath(), true)

	s3Path = s3SetupPathWinBeta()

	s3Url := "https://kjkpub.s3.amazonaws.com/" + s3Path
	buildOn := time.Now().Format("2006-01-02")
	jsTxt := fmt.Sprintf(`var LatestVerWin = "%s";
var LatestUrlWin = "%s";
var BuiltOnWin = "%s";
`, programVersion, s3Url, buildOn)
	s3UploadString(s3Dir+"latestverwinbeta.js", jsTxt, true)
	s3VerifyExistsWaitMust(s3Path)
}

func buildWinAll() {
	rememberDirs()

	verifyHasSecretsMust()
	detectInnoSetupMust()

	buildWinCef()
	buildSetupWin()

	buildWin()
	buildSetupWin()

	if flgBeta {
		uploadToS3WinBeta()
	} else {
		uploadToS3Win()
	}
}
