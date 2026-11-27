---
name: python
description: Use when writing, changing, reviewing or testing Python code (.py files, or a project with pyproject.toml, setup.py or requirements.txt). Covers finding the project's tools and conventions, idiomatic style and typing, layout, running pytest, and the mistakes that most often break Python changes.
license: MIT
metadata:
  file-types: "*.py *.pyi"
  project-files: "pyproject.toml setup.py setup.cfg requirements.txt Pipfile uv.lock poetry.lock"
---

# Python

## Find the project's conventions first

1. `pyproject.toml`: the build backend, the Python version (`requires-python`), dependencies,
   and tool sections (`[tool.ruff]`, `[tool.pytest.ini_options]`, `[tool.mypy]`,
   `[tool.pyright]`). Older projects use `setup.cfg`, `setup.py`, `requirements*.txt`, `tox.ini`.
2. The environment manager, from its lockfile: `uv.lock` (uv), `poetry.lock` (Poetry),
   `pdm.lock`, `Pipfile.lock`, or a plain virtual environment. Run commands through it
   (`uv run pytest`, `poetry run pytest`) so they use the project's interpreter and packages.
3. `Makefile`, `noxfile.py`, `tox.ini` or CI config, which show the commands the project runs.
4. Neighbouring modules: naming, docstring style, how errors are raised, whether type hints are used.

Never install packages into the system interpreter. Add dependencies through the project's
manager (`uv add`, `poetry add`) so the lockfile stays in step, and only when the user agrees.

## Style

- Follow the configured formatter and linter (often Ruff or Black). Do not reformat code you
  did not change.
- Type hints on public functions and methods; `from __future__ import annotations` or modern
  syntax (`list[int]`, `X | None`) as the minimum Python version allows.
- Use `pathlib.Path` for paths, f-strings for formatting, `dataclasses` (or the project's
  pydantic/attrs) for records, `enum.Enum` for fixed choices.
- Context managers (`with open(...)`) for files, locks and connections.
- Raise specific exceptions; catch only what you can handle. Never a bare `except:`.
- Comprehensions for simple transforms; a loop when it needs more than one condition or a side effect.
- Logging through `logging.getLogger(__name__)`, not `print`, in library code.
- Keep module import time cheap: no network or heavy work at import.

## Layout

```text
pyproject.toml
src/<package>/__init__.py   the importable package (src layout)
tests/test_<module>.py      tests mirror the package structure
```

Flat layouts (`<package>/` at the root) are also common; follow the project. Scripts with
inline dependencies (PEP 723 `# /// script` blocks) run with `uv run script.py`.

## Tests

pytest is the usual runner. If your agent can run commands, run it; otherwise give the user
the exact command.

```bash
uv run pytest
uv run pytest tests/test_parser.py::test_empty_input -x
```

Use `python -m pytest` inside a plain activated virtual environment.

- Write plain `assert` statements; pytest shows the values on failure.
- Fixtures in `conftest.py` for shared setup; `tmp_path` for files; `monkeypatch` for
  environment variables and attributes.
- `@pytest.mark.parametrize` for the same check over several inputs, including the edge cases
  (empty, None, unicode, very large).
- `pytest.raises(ValueError, match="...")` to check errors.
- Projects on `unittest` keep using it; pytest runs those tests too.

Run the type checker and linter the project configures (`uv run mypy src`, `uv run ruff check`)
before calling the change done.

## Common mistakes

- Mutable default arguments (`def f(items=[])`). Use `None` and create the list inside.
- Comparing to `None` with `==`; use `is None`.
- Catching `Exception` and hiding the error, or losing the cause; re-raise with `raise ... from err`.
- Naive datetimes. Use timezone-aware values (`datetime.now(tz=UTC)`).
- Building SQL or shell commands with string formatting. Use parameters and argument lists
  (`subprocess.run([...])`, never `shell=True` with user input).
- Relying on dict or set order where the code needs a sorted result.
- Blocking calls inside `async def` functions; use the async client or `asyncio.to_thread`.
- Editing a dependency file without updating the lockfile, or the other way round.
- Shadowing a standard library module with a local file (`random.py`, `json.py`).
