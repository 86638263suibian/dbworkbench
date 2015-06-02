package main

import (
	"database/sql"
	"fmt"

	"github.com/kjk/lzmadec"
	"github.com/kjk/stackoverflow"
	"github.com/lib/pq"
)

func importCommentsIntoDB(r *stackoverflow.Reader, db *sql.DB) (int, error) {
	txn, err := db.Begin()
	if err != nil {
		return 0, err
	}

	defer func() {
		if txn != nil {
			LogVerbosef("calling txn.Rollback(), err: %s\n", err)
			txn.Rollback()
		}
	}()

	stmt, err := txn.Prepare(pq.CopyIn("comments",
		"id",
		"post_id",
		"score",
		"text",
		"creation_date",
		"user_id",
		"user_display_name",
	))
	if err != nil {
		err = fmt.Errorf("txt.Prepare() failed with %s", err)
		return 0, err
	}
	n := 0
	for r.Next() {
		c := &r.Comment
		_, err = stmt.Exec(
			c.ID,
			c.PostID,
			c.Score,
			c.Text,
			c.CreationDate,
			c.UserID,
			c.UserDisplayName,
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

func importComments(archive *lzmadec.Archive, db *sql.DB) error {
	name := "Comments.xml"
	entry := getEntryForFile(archive, name)
	if entry == nil {
		LogVerbosef("genEntryForFile('%s') returned nil", name)
		return fmt.Errorf("genEntryForFile('%s') returned nil", name)
	}

	reader, err := archive.ExtractReader(entry.Path)
	if err != nil {
		LogVerbosef("ExtractReader('%s') failed with %s", entry.Path, err)
		return fmt.Errorf("ExtractReader('%s') failed with %s", entry.Path, err)
	}
	defer reader.Close()
	r, err := stackoverflow.NewCommentsReader(reader)
	if err != nil {
		LogVerbosef("NewPostsReader failed with %s", err)
		return fmt.Errorf("stackoverflow.NewUsersReader() failed with %s", err)
	}
	defer r.Close()
	n, err := importCommentsIntoDB(r, db)
	if err != nil {
		return fmt.Errorf("importBadgesIntoDB() failed with %s", err)
	}
	LogVerbosef("processed %d posts records\n", n)
	return nil
}