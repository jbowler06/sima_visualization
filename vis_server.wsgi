import sys
import logging

logging.basicConfig(sream=sys.stderr)
from app import app as application
