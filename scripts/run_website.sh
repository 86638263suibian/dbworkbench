#!/bin/bash

set -o nounset
set -o errexit
set -o pipefail

cd website
go vet ./...

go run *.go