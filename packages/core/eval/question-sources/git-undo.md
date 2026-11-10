---
type: article
title: Undoing things in Git without losing work
author: Mireille Okafor
---
Most fear of Git comes from one worry: that a wrong command will destroy work. It rarely can. Git keeps almost everything you commit for weeks, and each kind of mistake has its own undo. The skill is matching the command to what you want back.

## Three places a change can be

A change lives in one of three places. The working tree is the files on disk. The index, also called the staging area, is what the next commit will contain. The history is the chain of commits. Every undo command moves a change between these places, or moves a branch along the history.

## Before you commit

To throw away edits to a file you have not staged, run `git restore <file>`. The file goes back to what the index holds. This is one of the few commands that really does lose work, because edits that were never committed were never saved by Git.

To take a file out of the index but keep your edits on disk, run `git restore --staged <file>`. Nothing is lost: the change is still in the working tree, it just will not be in the next commit.

## After you commit, before you share

If the last commit has a typo in its message or is missing a file, stage what is missing and run `git commit --amend`. It does not edit the old commit. It builds a new commit and points the branch at it, and the old one is left behind with no branch pointing to it.

To step a branch back, use `git reset`. It takes three modes, and they differ only in what happens to the changes from the commits you step over. `--soft` leaves them in the index, ready to commit again. `--mixed`, the default, leaves them in the working tree, unstaged. `--hard` removes them from both, so the files look as they did at the commit you reset to. `git reset --soft HEAD~1` is the usual way to take back one commit and keep the work.

## After you share

Once other people have pulled your commits, stepping the branch back causes trouble. A reset moves the branch itself, so everyone who already has the old commits now holds a history that disagrees with yours, and their next push or pull has to reconcile the two.

For shared branches use `git revert <commit>` instead. A revert does not remove anything. It adds a new commit whose changes are the exact opposite of the commit you name, so the history only grows and nobody's copy is contradicted. The cost is a visible record of the mistake, which on a shared branch is usually what you want anyway.

## The safety net

Every time HEAD moves (a commit, a reset, a checkout, an amend) Git writes a line in the reflog, a private log of where HEAD has been. `git reflog` lists it. A commit that no branch points to any more, such as one left behind by an amend or a hard reset, can be reached again by its entry there, for example with `git reset --hard HEAD@{1}`.

The reflog is not forever. Its entries are kept for 90 days by default, and entries for commits that no branch can reach any more for 30 days. After that, Git's garbage collection may delete the commits. It is also local: it is never pushed, so it cannot rescue work from a machine you no longer have.

## One state that looks like a problem

A detached HEAD means HEAD points straight at a commit instead of at a branch. It happens when you check out a commit by its hash or a tag. It is safe for looking around. The catch is that commits you make there belong to no branch, so switching away leaves them reachable only through the reflog. If you want to keep them, make a branch before you leave: `git switch -c <name>`.
