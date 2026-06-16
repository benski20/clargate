Bad practices that you must avoid
Never add code comments
Never nest Python functions
Never use Any as a Python type
Never use abbreviated variable names (e.g. 'r' for response, 'sq' for survey_question)
Never use 'raw_' in variable or function names (e.g. 'raw_posts', 'raw_data', 'fetch_raw_*'). It papers over a missing type — if you need to distinguish an unparsed external response from a parsed domain object, introduce a dataclass for the parsed form rather than marking the dict version as untyped
Never add a None-type catch if an object's type annotation does not permit it to be None
Never use cast(). This implies a deeper data structure issue in the code that needs resolving
Never use getattr(). This implies a deeper data structure issue in the code that needs resolving
Avoid direct or indirect recursion
Never create __init__.py files in services — they are only needed in shared libraries/packages, not in deployed services
Never use pandas for simple data transformations — use plain Python (dicts, lists, sets)
Never add retry decorators to database queries unless explicitly requested
Never use TypedDicts — use frozen dataclasses instead
Good practices that you must follow
Write modular code with individually testable functionality
Minimise the number of dependencies required by any functions you write
Split code into separate files rather than writing big monoliths
Classes should have 5 methods or fewer
No function should be longer than 60 lines; file sizes/lengths should be no low/moderate and not extreme
Use inferred types wherever possible
Prioritise simple flow constructs
Prefer explicit failure over silent defaults. Code should fail loudly on unexpected input rather than masking issues with fallback values
Prefer keyword arguments over positional arguments in function calls
Prefer dataclasses over TypedDicts for structured data
Use fetch_ prefix for functions that query the database directly
Use resolve_ prefix for functions that orchestrate logic over DB queries
Initialise external clients (Exa, Cloud Tasks, etc.) in the FastAPI lifespan and access via dependency injection
Prefer early returns over nested conditionals