from flask import Flask

app = Flask(__name__)
app.config.from_mapping(APPLICATION_ROOT='/jack/vis_server')
from app import views
