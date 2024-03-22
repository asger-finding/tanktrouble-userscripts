#!/usr/bin/env bash

# | grep '\.user.js$'
# USERSCRIPTS=$(git diff origin/$(git name-rev --name-only HEAD)..HEAD --name-only | tr '\n' ',')
FILES_TO_COMMIT=$(git diff --name-only --cached)

if echo $FILES_TO_COMMIT | grep -q '\.user.js$'
then
    USERSCRIPTS=$(grep '\.user.js$' <<< "$FILES_TO_COMMIT")
    printf "\033[93mRemember to bump the version when committing a userscript change\033[0m\Diffed files:\n$USERSCRIPTS\n"
fi
