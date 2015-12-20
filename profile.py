#!flask/bin/python
from werkzeug.contrib.profiler import ProfilerMiddleware
from app import app
import config

app.config['PROFILE']=True
app.wsgi_app = ProfilerMiddleware(app.wsgi_app,restrictions=[30])
app.run(host='0.0.0.0', port=config.port, threaded=True, debug=True)
