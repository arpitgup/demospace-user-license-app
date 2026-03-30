From node:20-alpine as build

WORKDIR /app

COPY package*.json ./

RUN npm install -g @angular/cli

RUN npm install

# RUN npm CICD test environment basis.
COPY . .

ARG APP_ENV=production
ENV APP_ENV=$APP_ENV
RUN npm run build -- --output-path=./dist/frontend --configuration=$APP_ENV

FROM nginx:alpine


RUN rm -rf /usr/share/nginx/html
RUN rm -rf /usr/share/nginx/html/*

COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html

RUN rm -rf /etc/nginx/conf.d/default.conf
RUN rm -rf /etc/nginx/conf.d/angular.conf

COPY nginx.conf /etc/nginx/conf.d/angular.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]


