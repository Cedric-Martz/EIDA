#!/usr/bin/env python3
"""Create GitHub issues from CSV; requires gh auth login. Avoid rerunning (creates duplicates)."""
import csv,subprocess,pathlib
path=pathlib.Path(__file__).resolve().parents[1]/'planning'/'issues.csv'
with path.open(encoding='utf-8',newline='') as f:
 for row in csv.DictReader(f):
  body=f"Priority: {row['Priority']}\nMilestone: {row['Milestone']}\nArea: {row['Area']}\nEstimate: {row['Estimate Hours']} h\n\n## Acceptance criteria\n{row['Acceptance Criteria']}\n\n## Definition of done\n- [ ] Tests added\n- [ ] Docs updated\n- [ ] CI green\n"
  subprocess.run(['gh','issue','create','--title',row['Title'],'--body',body],check=True)
