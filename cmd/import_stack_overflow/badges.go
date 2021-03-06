package main

import (
	"database/sql"
	"fmt"

	"github.com/kjk/stackoverflow"
	"github.com/lib/pq"
)

func importBadgesIntoDB(r *stackoverflow.Reader, db *sql.DB) (int, error) {
	txn, err := db.Begin()
	if err != nil {
		return 0, err
	}

	defer func() {
		if txn != nil {
			txn.Rollback()
		}
	}()

	stmt, err := txn.Prepare(pq.CopyIn("badges",
		"id",
		"user_id",
		"name",
		"date",
	))
	if err != nil {
		err = fmt.Errorf("txt.Prepare() failed with %s", err)
		return 0, err
	}
	n := 0
	for r.Next() {
		b := &r.Badge
		_, err = stmt.Exec(
			b.ID,
			b.UserID,
			toStringPtr(b.Name),
			b.Date,
		)
		if err != nil {
			err = fmt.Errorf("stmt.Exec() failed with %s", err)
			return 0, err
		}
		n++
	}
	if err = r.Err(); err != nil {
		return 0, err
	}
	_, err = stmt.Exec()
	if err != nil {
		err = fmt.Errorf("stmt.Exec() failed with %s", err)
		return 0, err
	}
	err = stmt.Close()
	if err != nil {
		err = fmt.Errorf("stmt.Close() failed with %s", err)
		return 0, err
	}
	err = txn.Commit()
	txn = nil
	if err != nil {
		err = fmt.Errorf("txn.Commit() failed with %s", err)
		return 0, err
	}
	return n, nil
}

func importBadges(siteName string, db *sql.DB) (int, error) {
	reader, err := getStackOverflowReader(siteName, "Badges")
	if err != nil {
		return 0, err
	}
	defer reader.Close()
	r, err := stackoverflow.NewBadgesReader(reader)
	if err != nil {
		return 0, fmt.Errorf("stackoverflow.NewBadgesReader() failed with %s", err)
	}
	defer r.Close()
	return importBadgesIntoDB(r, db)
}
