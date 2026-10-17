if (Test-Path "$PSScriptRoot\..\.venv\Scripts\python.exe") {
    $python = "$PSScriptRoot\..\.venv\Scripts\python.exe"
} else {
    $python = "python"
}
& $python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000

