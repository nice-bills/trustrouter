FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
COPY tsconfig.json ./

# Install ALL dependencies (including dev) so we can run tsc
RUN npm install

# Copy source code
COPY src ./src

# Build it inside the container
RUN npm run build

EXPOSE 8080

CMD [ "npm", "start" ]
