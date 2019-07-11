import sys
import logging


print '-------'
print environ

logging.basicConfig(sream=sys.stderr)
from app import app as application
