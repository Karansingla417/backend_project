FROM node:14

WORKDIR /app

COPY package*.json ./
COPY package-lock.json ./

RUN npm install

COPY . .

EXPOSE 3000
EXPOSE 3010
EXPOSE 3005
EXPOSE 3003

