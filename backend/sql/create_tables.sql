-- Create custom ENUM types for status fields
CREATE TYPE reservation_status_enum AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED');


CREATE TABLE app_config (
    id SERIAL PRIMARY KEY,
    key VARCHAR UNIQUE NOT NULL,
    value BOOLEAN,
    description VARCHAR
);
CREATE INDEX idx_app_config_key ON app_config (key);


CREATE TABLE applications (
    id SERIAL PRIMARY KEY,
    name VARCHAR UNIQUE NOT NULL
);


CREATE TABLE bots (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    email VARCHAR UNIQUE NOT NULL
);


CREATE TABLE bot_applications (
    bot_id INTEGER NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    PRIMARY KEY (bot_id, application_id)
);
CREATE INDEX idx_bot_applications_application_id ON bot_applications (application_id);


CREATE TABLE reservations (
    id BIGSERIAL PRIMARY KEY,
    user_email VARCHAR NOT NULL,
    bot_id INTEGER REFERENCES bots(id),
    primary_application_id INTEGER REFERENCES applications(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    status reservation_status_enum DEFAULT 'PENDING',
    provisioning_task_id VARCHAR,
    deprovisioning_task_id VARCHAR
);
CREATE INDEX idx_reservations_user_email ON reservations (user_email);
CREATE INDEX idx_reservations_bot_id ON reservations (bot_id);
CREATE INDEX idx_reservations_start_time ON reservations (start_time);
CREATE INDEX idx_reservations_end_time ON reservations (end_time);
CREATE INDEX idx_reservations_status ON reservations (status);


CREATE TABLE reservation_applications (
    reservation_id BIGINT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    PRIMARY KEY (reservation_id, application_id)
);
