-- Схема PostgreSQL для сервиса планирования.
-- Документы API (справочники, наряды, планы) хранятся в JSONB: их формат
-- определяется внешним контрактом, а БД отвечает за целостность и выборки.

CREATE TABLE IF NOT EXISTS reference_data (
    id         SMALLINT    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    payload    JSONB       NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS travel_matrix (
    id         SMALLINT    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    payload    JSONB       NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS day (
    date       DATE        PRIMARY KEY,
    payload    JSONB       NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plan (
    date       DATE        PRIMARY KEY REFERENCES day (date) ON DELETE CASCADE,
    payload    JSONB       NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS day_version (
    date    DATE PRIMARY KEY REFERENCES day (date) ON DELETE CASCADE,
    version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS day_event (
    id         BIGSERIAL   PRIMARY KEY,
    date       DATE        NOT NULL REFERENCES day (date) ON DELETE CASCADE,
    event_id   TEXT        NOT NULL,
    payload    JSONB       NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (date, event_id)
);

CREATE INDEX IF NOT EXISTS day_event_date_idx ON day_event (date);

CREATE TABLE IF NOT EXISTS day_model_now (
    date   DATE        PRIMARY KEY REFERENCES day (date) ON DELETE CASCADE,
    now_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS day_cancelled (
    id      BIGSERIAL PRIMARY KEY,
    date    DATE      NOT NULL REFERENCES day (date) ON DELETE CASCADE,
    payload JSONB     NOT NULL
);

CREATE INDEX IF NOT EXISTS day_cancelled_date_idx ON day_cancelled (date);

CREATE TABLE IF NOT EXISTS day_alert (
    id       BIGSERIAL PRIMARY KEY,
    date     DATE      NOT NULL REFERENCES day (date) ON DELETE CASCADE,
    position INTEGER   NOT NULL,
    payload  JSONB     NOT NULL,
    UNIQUE (date, position)
);

CREATE TABLE IF NOT EXISTS day_removed_order (
    date     DATE NOT NULL REFERENCES day (date) ON DELETE CASCADE,
    order_id TEXT NOT NULL,
    PRIMARY KEY (date, order_id)
);

CREATE TABLE IF NOT EXISTS day_extra_order (
    id      BIGSERIAL PRIMARY KEY,
    date    DATE      NOT NULL REFERENCES day (date) ON DELETE CASCADE,
    payload JSONB     NOT NULL
);

CREATE INDEX IF NOT EXISTS day_extra_order_date_idx ON day_extra_order (date);

CREATE TABLE IF NOT EXISTS day_unavailable_staff (
    date     DATE NOT NULL REFERENCES day (date) ON DELETE CASCADE,
    staff_id TEXT NOT NULL,
    PRIMARY KEY (date, staff_id)
);

CREATE TABLE IF NOT EXISTS day_visit_end (
    date     DATE        NOT NULL REFERENCES day (date) ON DELETE CASCADE,
    order_id TEXT        NOT NULL,
    end_at   TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (date, order_id)
);
