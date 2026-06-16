
For each changed file, check against the project's coding standards.

Must not contain (from CLAUDE.md):

Code comments
Nested Python functions
Any as a type annotation
Abbreviated variable names (e.g. r, sq, resp)
None-type catches where the type annotation doesn't permit None
Usage of cast() or getattr()
Direct or indirect recursion
Must follow (from CLAUDE.md):

Functions under 60 lines
Classes with 5 methods or fewer
Inferred types where possible
Explicit failure over silent defaults
Keyword arguments over positional arguments
Modular, individually testable code
Code split across files, not monolithic
Also check for:

Security issues (hardcoded secrets, missing input validation, injection risks)
Logic errors or edge cases
Missing error handling at system boundaries
Unnecessary complexity or dead code
Inconsistent naming or patterns compared to the rest of the codebase