package Course.SpringLearning;

import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import javax.sql.DataSource;

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
            // Check if it is a standard PostgreSQL URI format
            if (url.startsWith("jdbc:")) {
                String cleanUrl = url.substring(5);
                if (cleanUrl.startsWith("postgresql://")) {
                    parseAndConfigure(cleanUrl, properties);
                }
            } else if (url.startsWith("postgresql://")) {
                parseAndConfigure(url, properties);
            } else {
                properties.setUrl(url);
            }
        }

        return properties.initializeDataSourceBuilder().build();
    }

    private void parseAndConfigure(String uriStr, DataSourceProperties properties) {
        // Remove postgresql:// prefix
        String cleanUri = uriStr.substring(13);
        
        int atIndex = cleanUri.indexOf('@');
        if (atIndex != -1) {
            String credentials = cleanUri.substring(0, atIndex);
            String hostAndDb = cleanUri.substring(atIndex + 1);
            
            int colonIndex = credentials.indexOf(':');
            if (colonIndex != -1) {
                properties.setUsername(credentials.substring(0, colonIndex));
                properties.setPassword(credentials.substring(colonIndex + 1));
            } else {
                properties.setUsername(credentials);
            }
            properties.setUrl("jdbc:postgresql://" + hostAndDb);
        } else {
            properties.setUrl("jdbc:postgresql://" + cleanUri);
        }
    }
}
