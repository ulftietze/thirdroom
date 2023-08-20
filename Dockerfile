FROM nginx:alpine

# Install nodejs, npm and yarn to build this project
RUN apk add --update nodejs npm
RUN apk add --no-cache git openssh
RUN npm install -g yarn

WORKDIR /app
COPY . .
COPY ./nginx.conf /etc/nginx/nginx.conf

RUN yarn install
RUN yarn build
