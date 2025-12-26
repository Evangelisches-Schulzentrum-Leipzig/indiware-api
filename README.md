# Timetable API

REST API for accessing school timetable data, substitution plans, and room availability information.  
Integrates with Indiware/Stundenplan24 data sources.  
  
Includes OpenAPI documentation and Swagger-Viewer.

## Features

- Metadata endpoints for classes, subjects, rooms, teachers, holidays, and periods
- Daily and weekly timetable plans grouped by class, teacher, or room
- Timetable change tracking and substitution details
- Room availability information
- Current period detection based on timestamp

## Requirements

- Node.js
- MariaDB
- TypeScript

## Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
   For development use:
   ```
   npm install -D
   ```
3. Set up the database using the schema in `database/schema_v2.sql`
4. Configure environment variables or create `.env` file with same content:
   ```
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=timetable_v2
   API_PORT=80
   EVS_TEACH_PASSWORD=teacher_password
   EVS_STUD_PASSWORD=student_password
   ```

## Usage

Build the project:
```
npm run build
```

Start the server:
```
npm start
```

For development:
```
npm run dev
```

### API Documentation

OpenAPI specification and Swagger UI are available at:
- Swagger UI: `http://localhost/swagger`
- OpenAPI YAML: `http://localhost/openapi.yaml`
- OpenAPI JSON: `http://localhost/openapi.json`

## Docker for local database

A Docker Compose configuration is provided for local development with MariaDB and phpMyAdmin:

```
docker-compose up -d
```

This starts:
- MariaDB on port 3306
- phpMyAdmin on port 8080

## Contributing

Contributions of any kind are welcome.

## License

[Open Software License 3.0](https://choosealicense.com/licenses/osl-3.0/)