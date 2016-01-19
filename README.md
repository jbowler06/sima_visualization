# sima_visualization

Overview
--------
Visualization server built on the Flask microframework for inspecting time series data, motion correction results, and ROIs processed with the 
SIMA packages <https://github.com/losonczylab/sima>.

Installation and Use
--------------------
Copy config.py.tmpl to config.py, adjust the port number for flask to run on and execute run.py. For information on using
Flask microframework see <http://flask.pocoo.org/> or the tutorial at <http://blog.miguelgrinberg.com/post/the-flask-mega-tutorial-part-i-hello-world>

This program must have read permission on SIMA dataset sets to be inspected (and write permissions if used to save ROIs).


Dependencies
------------
- sima
- flask
