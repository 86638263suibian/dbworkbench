package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
)

const (
	s3Dir = "software/databaseworkbench/"
)

var (
	flgNoCleanCheck     bool
	flgUpload           bool
	flgUploadAutoUpdate bool

	programVersionWin string
	programVersionMac string
	programVersion    string
	certPath          string
	cachedSecrets     *Secrets
	innoSetupPath     string
)

// Secrets defines secrets
type Secrets struct {
	AwsSecret        string
	AwsAccess        string
	CertPwd          string
	NotifierEmail    string
	NotifierEmailPwd string
}

func finalizeThings(crashed bool) {
	// nothing for us
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

func parseCmdLine() {
	// -no-clean-check is useful when testing changes to this build script
	flag.BoolVar(&flgNoCleanCheck, "no-clean-check", false, "allow running if repo has changes (for testing build script)")
	flag.BoolVar(&flgUpload, "upload", false, "if true, upload the files")
	flag.Parse()
}

func isGitCleanMust() bool {
	out, err := runExe("git", "status", "--porcelain")
	fataliferr(err)
	s := strings.TrimSpace(string(out))
	return len(s) == 0
}

func verifyGitCleanMust() {
	if !flgUpload || flgNoCleanCheck {
		return
	}
	fatalif(!isGitCleanMust(), "git has unsaved changes\n")
}

func readSecretsMust(path string) *Secrets {
	if cachedSecrets != nil {
		return cachedSecrets
	}
	d, err := ioutil.ReadFile(path)
	fatalif(err != nil, "readSecretsMust(): error %s reading file '%s'\n", err, path)
	var s Secrets
	err = json.Unmarshal(d, &s)
	fatalif(err != nil, "readSecretsMust(): failed to json-decode file '%s'. err: %s, data:\n%s\n", path, err, string(d))
	cachedSecrets = &s
	return cachedSecrets
}

func verifyHasSecretsMust() {
	certPath = pj("scripts", "cert.pfx")
	if !fileExists(certPath) {
		certPath = pj("..", "..", "..", "..", "..", "sumatrapdf", "scripts", "cert.pfx")
		fatalif(!fileExists(certPath), "didn't find cert.pfx in scripts/ or ../../../sumatrapdf/scripts/")
	}
	absPath, err := filepath.Abs(certPath)
	fataliferr(err)
	certPath = absPath
	fmt.Printf("signing certificate: '%s'\n", certPath)

	secretsPath := pj("scripts", "secrets.json")
	if !fileExists(secretsPath) {
		secretsPath = pj("..", "..", "..", "..", "..", "sumatrapdf", "scripts", "secrets.json")
		fatalif(!fileExists(secretsPath), "didn't find secrets.json in scripts/ or ../../../sumatrapdf/scripts/")
	}
	secrets := readSecretsMust(secretsPath)
	if flgUpload || flgUploadAutoUpdate {
		// when uploading must have s3 credentials
		s3SetSecrets(secrets.AwsAccess, secrets.AwsSecret)
	}
}

func isWin() bool {
	return runtime.GOOS == "windows"
}

func isMac() bool {
	return runtime.GOOS == "darwin"
}

// given 1.1.0 returns "1.1" i.e. removes all trailing '0' and '.'
func cleanVer(s string) string {
	return strings.TrimRight(s, "0.")
}

func extractVersionWinMust() {
	path := filepath.Join("win", "DatabaseWorkbench", "Properties", "AssemblyInfo.cs")
	d, err := ioutil.ReadFile(path)
	fataliferr(err)
	r := regexp.MustCompile(`(?mi)AssemblyFileVersion\("([^"]+)`)
	s := string(d)
	res := r.FindStringSubmatch(s)
	fatalif(len(res) != 2, "didn't find AssemblyFileVersion in:\n'%s'\n", s)
	programVersionWin = cleanVer(res[1])
	verifyCorrectVersionMust(programVersionWin)
	fmt.Printf("programVersionWin: %s\n", programVersionWin)
}

func extractVersionMacMust() {
	args := []string{
		"-c",
		"Print CFBundleShortVersionString",
		"./mac-client/dbworkbench/Info.plist",
	}

	// /usr/libexec/PlistBuddy -c "Print CFBundleShortVersionString" "./mac-client/dbworkbench/Info.plist"
	cmd := exec.Command("/usr/libexec/PlistBuddy", args...)
	macVersionByteArray, err := runCmd(cmd, true)
	fataliferr(err)

	// Can't convert directly with macVersionByteArray[:]
	// because comparasion fails for the last character
	programVersionMac = string(macVersionByteArray[:3])

	verifyCorrectVersionMust(programVersionMac)
	fmt.Printf("programVersionMac: %s\n", programVersionMac)
}

func extractVersionMust() {
	extractVersionWinMust()
	if isMac() {
		// TODO: implement in a way that works on windows
		extractVersionMacMust()
		fatalif(programVersionMac != programVersionWin, "programVersionMac != programVersionWin ('%s' != '%s')", programVersionMac, programVersionWin)
		programVersion = programVersionMac
	} else {
		programVersion = programVersionWin
	}
	fmt.Printf("programVersion: %s\n", programVersion)
}

func buildMac() {
	// TODO: write me
	// fatalf("not yet implemented")

	// TODO: Zip the bundle

	// MAybe TODO: Upload to S3
}

func main() {
	parseCmdLine()
	if isWin() {
		fmt.Printf("Starting windows build\n")
	} else if isMac() {
		fmt.Printf("Starting mac build\n")
	} else {
		log.Fatalf("unsupported os, runtime.GOOS='%s'\n", runtime.GOOS)
	}
	verifyGitCleanMust()
	extractVersionMust()
	if isWin() {
		buildWinAll()
	}

	if isMac() {
		buildMac()
	}
}
