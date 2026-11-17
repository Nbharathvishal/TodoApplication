package Course.SpringLearning;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class DatabaseMigrationInitializer implements CommandLineRunner {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) {
        log.info("Checking database schema compatibility...");
        try {
            // Alter todo.description to TEXT in PostgreSQL if it was varchar(255)
            jdbcTemplate.execute("ALTER TABLE todo ALTER COLUMN description TYPE TEXT");
            log.info("Database migration: ensured todo.description column is of type TEXT.");
        } catch (Exception ex) {
            log.info("Database migration note (todo.description): {}", ex.getMessage());
        }

        try {
            // Alter "todo" if case sensitivity is enforced
            jdbcTemplate.execute("ALTER TABLE \"todo\" ALTER COLUMN \"description\" TYPE TEXT");
        } catch (Exception ignored) {
        }
    }
}
