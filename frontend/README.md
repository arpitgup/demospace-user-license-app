# Agentspace License Reservation Frontend

This project is the frontend for a web-based reservation system that allows users to book and manage licenses for various software agents. It's built with Angular and designed to interact with a separate backend API.

## Features

* Search for available license slots by date or by application.
* Book new reservations for a desired  time window.
* View all upcoming and past reservations.
* Cancel active reservations.


## Technology Stack

* **Framework:** Angular (v17+)
* **UI Components:** Angular Material
* **State Management:** Angular Signals
* **Unit Testing:** Jest
* **Styling:** SCSS


## Table of Contents

- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Development](#development)

---

## Project Structure

The project follows a standard Angular architecture, organizing files by their function and feature area.

```
frontend/
├── src/
│   ├── app/
│   │   ├── core/
│   │   │   ├── models/
│   │   │   ├── services/
│   │   │   └── ...
│   │   │
│   │   ├── pages/
│   │   │   ├── landing-page/
│   │   │   └── ...
│   │   │
│   │   ├── shared/
│   │   │   ├── components/
│   │   │   ├── dialogs/
│   │   │   └── ...
│   │   │
│   │   ├── app.component.scss
│   │   ├── app.component.html
│   │   ├── app.component.ts
│   │   └── app.routes.ts
│   │
│   ├── assets/
│   │   └── ...
│   │
│   └── environments/
│       ├── environment.prod.ts
│       └── environment.ts
│
├── .editorconfig
├── .gitignore
├── angular.json
├── package.json
├── README.md
└── tsconfig.json
```


## Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v20.x or later recommended)
- [Docker](https://www.docker.com/)(If you plan to run the backend service in a container)

---

## Installation

1.  **Clone the repository:**
    ```bash
    git clone https://ssm-demo-instance-659143206033-git.us-central1.sourcemanager.dev/tasbirimam-1121-20250225154029/license-reservation-app.git
    cd frontend
    ```

2.  **Install NPM packages:**
    ```bash
    npm install
    ```

---

## Development

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Jest](https://jestjs.io/docs/getting-started) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
