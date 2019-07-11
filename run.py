#!flask/bin/python
from app import app
import config

app.config['APPLICATION_ROOT'] = '/jack/vis_server'
app.run(host='0.0.0.0', port=config.port,  debug=True, processes=1)
