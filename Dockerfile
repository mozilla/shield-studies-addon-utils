FROM ubuntu:16.04
WORKDIR /shield-study-addon-utils

RUN apt-get update -y && \
    apt-get install -y curl && \
    curl -sL https://deb.nodesource.com/setup_8.x | bash - && \
    npm install -g npm@5.3.0 && \
    apt-get update -y && \
    apt-get install -y zip firefox xvfb nodejs xsel git ssh openbox

ENV PATH="/shield-study-utils/node_modules/.bin:$PATH"
