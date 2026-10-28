package Course.SpringLearning;

import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import javax.sql.DataSource;
import java.net.URI;

@Configuration
public class DatabaseConfig {

    @Bean
    @Primary
    public DataSource dataSource(DataSourceProperties properties) {
        String url = System.getenv("SPRING_DATASOURCE_URL");
        if (url == null || url.isEmpty()) {
            url = System.getenv("DATABASE_URL");
        }

        if (url != null && !url.isEmpty()) {
            configureDatabaseUrl(url, properties);
        }

        return properties.initializeDataSourceBuilder().build();
    }

    private void configureDatabaseUrl(String rawUrl, DataSourceProperties properties) {
        try {
            String cleanUrl = rawUrl.trim();

            if (cleanUrl.startsWith("jdbc:postgresql://")) {
                properties.setUrl(cleanUrl);
                return;
            }

            if (cleanUrl.startsWith("jdbc:")) {
                cleanUrl = cleanUrl.substring(5);
            }

            // Normalise schema to standard postgresql://
            if (cleanUrl.startsWith("postgres://")) {
                cleanUrl = "postgresql://" + cleanUrl.substring(11);
            }

            if (cleanUrl.startsWith("postgresql://")) {
                URI uri = new URI(cleanUrl);

                String userInfo = uri.getUserInfo();
                if (userInfo != null && !userInfo.isEmpty()) {
                    String[] userParts = userInfo.split(":", 2);
                    properties.setUsername(userParts[0]);
                    if (userParts.length > 1) {
                        properties.setPassword(userParts[1]);
                    }
                }

                String host = uri.getHost();
                int port = uri.getPort() > 0 ? uri.getPort() : 5432;
                String path = uri.getPath(); // starts with /
                String query = uri.getQuery();

                StringBuilder jdbcUrl = new StringBuilder("jdbc:postgresql://")
                        .append(host)
                        .append(":")
                        .append(port)
                        .append(path != null ? path : "");

                if (query != null && !query.isEmpty()) {
                    jdbcUrl.append("?").append(query);
                } else if (!"localhost".equals(host) && !"127.0.0.1".equals(host)) {
                    // For cloud databases (Render/Neon/Supabase/etc.) default to sslmode=require
                    jdbcUrl.append("?sslmode=require");
                }

                properties.setUrl(jdbcUrl.toString());
            } else {
                properties.setUrl(cleanUrl);
            }
        } catch (Exception e) {
            properties.setUrl(rawUrl);
        }
    }
}
