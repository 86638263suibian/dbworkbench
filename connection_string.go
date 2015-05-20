package main

import (
	"errors"
	"fmt"

	"strings"
)

func formatConnectionURL(opts Options) (string, error) {
	url := opts.URL

	// Make sure to only accept urls in a standard format
	if !strings.Contains(url, "postgres://") {
		return "", errors.New("Invalid URL. Valid format: postgres://user:password@host:port/db?sslmode=mode")
	}

	// Special handling for local connections
	if strings.Contains(url, "localhost") || strings.Contains(url, "127.0.0.1") {
		if !strings.Contains(url, "?sslmode") {
			if opts.Ssl == "" {
				url += fmt.Sprintf("?sslmode=%s", "disable")
			} else {
				url += fmt.Sprintf("?sslmode=%s", opts.Ssl)
			}
		}
	}

	// Append sslmode parameter only if its defined as a flag and not present
	// in the connection string.
	if !strings.Contains(url, "?sslmode") && opts.Ssl != "" {
		url += fmt.Sprintf("?sslmode=%s", opts.Ssl)
	}

	return url, nil
}

func connectionSettingsBlank(opts Options) bool {
	return opts.Host == "" && opts.User == "" && opts.DbName == "" && opts.URL == ""
}

func buildConnectionString(opts Options) (string, error) {
	if opts.URL != "" {
		return formatConnectionURL(opts)
	}

	// Disable ssl for localhost connections, most users have it disabled
	if opts.Host == "localhost" || opts.Host == "127.0.0.1" {
		if opts.Ssl == "" {
			opts.Ssl = "disable"
		}
	}

	url := "postgres://"

	if opts.User != "" {
		url += opts.User
	}

	if opts.Pass != "" {
		url += fmt.Sprintf(":%s", opts.Pass)
	}

	url += fmt.Sprintf("@%s:%d", opts.Host, opts.Port)

	if opts.DbName != "" {
		url += fmt.Sprintf("/%s", opts.DbName)
	}

	if opts.Ssl != "" {
		url += fmt.Sprintf("?sslmode=%s", opts.Ssl)
	}

	return url, nil
}
