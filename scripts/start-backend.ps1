$python = 'C:\Users\Aarya\AppData\Local\Python\bin\python3.14.exe'
& $python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
