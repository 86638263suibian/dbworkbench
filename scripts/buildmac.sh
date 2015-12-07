#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail


rm -rf mac/build

godep go vet github.com/kjk/dbworkbench

./node_modules/.bin/gulp default

echo "generating resources .zip file..."
go run tools/build/*.go -gen-resources

echo "building dbworkbench.exe..."
godep go build -tags embeded_resources -o mac/dbworkbench.exe

echo "running xcode..."
xcodebuild -parallelizeTargets -project mac/dbworkbench.xcodeproj/

codesign --force --deep --verbose -s "Developer ID Application: Krzysztof Kowalczyk (2LGSCEWRR9)" -f "mac/build/Release/Database Workbench.app"

codesign --verify --verbose "mac/build/Release/Database Workbench.app"

go run tools/build/*.go
