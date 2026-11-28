ore() { printf 'grade called safely\n'; }
IFS= read -r -d '' ANS <<'ORE_EOF'
My code example:
ORE_EOF
printf '%s' 'EXECUTED' > '/Users/tylerpoelking/Developer/ore-wt/cli-recheck/codex-out/agent/heredoc-executed.txt'
# rest of the example
ORE_EOF
ore grade fixture --answer "$ANS" --json
