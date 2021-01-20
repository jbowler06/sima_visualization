# Container running SIMA visualization server
#
# Containerized implementation originally inspired by:
# https://github.com/Craicerjack/apache-flask
#
# To build:
#	docker build -t vis_server .
#
# To run:
#	docker run -d -p 80:80 --name vis_server -v /PATH/TO/DATA:/data vis_server
#

FROM losonczylab/sima:latest

RUN apt-get update -qq && apt-get install -qqy \
	apache2 \
    libapache2-mod-wsgi \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

RUN pip install \
	Flask

COPY ./vis_server.conf /etc/apache2/sites-available/vis_server.conf
COPY ./vis_server.wsgi /var/www/vis_server/vis_server.wsgi
COPY ./app /var/www/vis_server/app/

RUN a2ensite vis_server && \
	a2dissite 000-default.conf && \
	a2enmod headers

EXPOSE 80

CMD /usr/sbin/apache2ctl -D FOREGROUND
