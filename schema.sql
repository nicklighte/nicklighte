-- Green Agribusiness database (MySQL / MariaDB / XAMPP)
-- Run once in phpMyAdmin (Import tab) or:  mysql -u root < schema.sql
--
-- Safe to run more than once (CREATE ... IF NOT EXISTS). If you already have OLD tables with
-- different columns and get "Unknown column" errors, start clean by running these two lines first:
--     DROP DATABASE IF EXISTS green_agribusiness;
-- (this deletes ALL data in that database, which is fine while you are still developing)

CREATE DATABASE IF NOT EXISTS green_agribusiness CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE green_agribusiness;

CREATE TABLE IF NOT EXISTS users (
    id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role          ENUM('farmer','buyer','admin') NOT NULL,
    full_name     VARCHAR(80)  NOT NULL,
    email         VARCHAR(120) NOT NULL UNIQUE,
    phone         VARCHAR(20),
    password_hash VARCHAR(100) NOT NULL,           -- bcrypt hash, never the password itself
    location      VARCHAR(80),
    bio           TEXT,
    is_approved   TINYINT NOT NULL DEFAULT 0,       -- 0 pending, 1 approved, 2 rejected
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
    id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS produce (
    id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    farmer_id   INT UNSIGNED NOT NULL,
    category_id INT UNSIGNED NOT NULL,
    name        VARCHAR(80)  NOT NULL,
    description TEXT,
    price_kes   INT UNSIGNED NOT NULL,
    unit        VARCHAR(10)  NOT NULL DEFAULT 'kg',
    quantity    INT UNSIGNED NOT NULL DEFAULT 0,
    photo       VARCHAR(60),
    location    VARCHAR(80)  NOT NULL,
    status      ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_produce_farmer   FOREIGN KEY (farmer_id)   REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_produce_category FOREIGN KEY (category_id) REFERENCES categories(id),
    INDEX idx_produce_status (status),
    INDEX idx_produce_category (category_id),
    INDEX idx_produce_farmer (farmer_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
    id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    buyer_id         INT UNSIGNED NOT NULL,
    status           ENUM('placed','confirmed','dispatched','delivered') NOT NULL DEFAULT 'placed',
    delivery_address VARCHAR(300) NOT NULL,
    phone            VARCHAR(20)  NOT NULL,
    total_kes        INT UNSIGNED NOT NULL,
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_orders_buyer FOREIGN KEY (buyer_id) REFERENCES users(id),
    INDEX idx_orders_buyer (buyer_id)
) ENGINE=InnoDB;

-- Name, unit and price are copied here when the order is placed, so receipts never change later.
CREATE TABLE IF NOT EXISTS order_items (
    id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id     INT UNSIGNED NOT NULL,
    produce_id   INT UNSIGNED NULL,
    farmer_id    INT UNSIGNED NOT NULL,
    produce_name VARCHAR(80)  NOT NULL,
    unit         VARCHAR(10)  NOT NULL,
    unit_price   INT UNSIGNED NOT NULL,
    quantity     INT UNSIGNED NOT NULL,
    line_total   INT UNSIGNED NOT NULL,
    CONSTRAINT fk_items_order   FOREIGN KEY (order_id)   REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_items_produce FOREIGN KEY (produce_id) REFERENCES produce(id) ON DELETE SET NULL,
    CONSTRAINT fk_items_farmer  FOREIGN KEY (farmer_id)  REFERENCES users(id),
    INDEX idx_items_order (order_id),
    INDEX idx_items_farmer (farmer_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS contact_messages (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(80)  NOT NULL,
    email      VARCHAR(120) NOT NULL,
    message    TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
