# Bad practices that you must avoid

- Never add code comments
- Never nest Python functions
- Never use Any as a Python type
- Never use abbreviated variable names (e.g. 'r' for response, 'sq' for survey_question)
- Never add a None-type catch if an object's type annotation does not permit it to be None
- Never use cast(). This implies a deeper data structure issue in the code that needs resolving
- Never use getattr(). This implies a deeper data structure issue in the code that needs resolving
- Avoid direct or indirect recursion

# Good practices that you must follow

- Write modular code with individually testable functionality
- Minimise the number of dependencies required by any functions you write
- Split code into separate files rather than writing big monoliths
- Classes should have 5 methods or fewer
- No function should be longer than 60 lines
- Use inferred types wherever possible
- Prioritise simple flow constructs
- Prefer explicit failure over silent defaults. Code should fail loudly on unexpected input rather than masking issues with fallback values