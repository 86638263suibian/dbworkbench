package main

import (
	"archive/zip"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
)

var (
	blaclisted = []string{
		"s/dist/bundle.js.map",
		".gitkeep",
		// TODO: eventually delete the files we don't use
		// currently we use bootstrap-flatly.css
		"s/css/bootstrap.css",
		"s/css/normalize.css",
	}
)

func isBlacklisted(path string) bool {
	for _, s := range blaclisted {
		if path == s {
			return true
		}
	}
	return false
}

func createResourcesZip(path string) {
	f, err := os.Create(path)
	fataliferr(err)
	defer f.Close()
	zw := zip.NewWriter(f)
	currDir, err := os.Getwd()
	fataliferr(err)
	dir := filepath.Join(currDir, "s")
	addZipDirMust(zw, dir, currDir)
	err = zw.Close()
	fataliferr(err)
}

var hdr = `// +build embeded_resources

package main

var resourcesZipData = []byte{
`

func genHexLine(f *os.File, d []byte, off, n int) {
	f.WriteString("\t")
	for i := 0; i < n; i++ {
		b := d[off+i]
		fmt.Fprintf(f, "0x%02x,", b)
	}
	f.WriteString("\n")
}

func genResourcesGo(goPath, dataPath string) {
	d, err := ioutil.ReadFile(dataPath)
	fataliferr(err)
	f, err := os.Create(goPath)
	fataliferr(err)
	defer f.Close()
	f.WriteString(hdr)

	nPerLine := 16
	nFullLines := len(d) / nPerLine
	nLastLine := len(d) % nPerLine
	n := 0
	for i := 0; i < nFullLines; i++ {
		genHexLine(f, d, n, nPerLine)
		n += nPerLine
	}
	genHexLine(f, d, n, nLastLine)
	f.WriteString("}\n")
}

func genResources() {
	zipPath := "dbworkbench.zip"
	createResourcesZip(zipPath)
	goPath := "resources.go"
	genResourcesGo(goPath, zipPath)
}
