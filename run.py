#!flask/bin/python
from app import app
import config

app.run(host='0.0.0.0', port=config.port, threaded=True)
