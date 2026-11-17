package Course.SpringLearning.utils;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;

@Component
public class JwtUtil {

    // Access token valid for 24 hours
    private static final long ACCESS_TOKEN_EXPIRATION = 1000L * 60 * 60 * 24;
    // Refresh token valid for 7 days
    private static final long REFRESH_TOKEN_EXPIRATION = 1000L * 60 * 60 * 24 * 7;

    private final Key secretKey = Keys.hmacShaKeyFor(
            System.getenv().getOrDefault("JWT_SECRET", "mysecretkeymysecretkeymysecretkey123456")
                    .getBytes(StandardCharsets.UTF_8)
    );

    public String generateToken(String email) {
        return generateAccessToken(email);
    }

    public String generateAccessToken(String email) {
        return Jwts.builder()
                .setSubject(email)
                .claim("type", "access")
                .setIssuedAt(new Date(System.currentTimeMillis()))
                .setExpiration(new Date(System.currentTimeMillis() + ACCESS_TOKEN_EXPIRATION))
                .signWith(secretKey, SignatureAlgorithm.HS256)
                .compact();
    }

    public String generateRefreshToken(String email) {
        return Jwts.builder()
                .setSubject(email)
                .claim("type", "refresh")
                .setIssuedAt(new Date(System.currentTimeMillis()))
                .setExpiration(new Date(System.currentTimeMillis() + REFRESH_TOKEN_EXPIRATION))
                .signWith(secretKey, SignatureAlgorithm.HS256)
                .compact();
    }

    public String extractEmail(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(secretKey)
                .build()
                .parseClaimsJws(token)
                .getBody()
                .getSubject();
    }

    public boolean validationToken(String token) {
        try {
            Claims claims = Jwts.parserBuilder()
                    .setSigningKey(secretKey)
                    .build()
                    .parseClaimsJws(token)
                    .getBody();
            String type = claims.get("type", String.class);
            return type == null || "access".equals(type);
        } catch (JwtException | IllegalArgumentException exception) {
            return false;
        }
    }

    public boolean validateRefreshToken(String token) {
        try {
            Claims claims = Jwts.parserBuilder()
                    .setSigningKey(secretKey)
                    .build()
                    .parseClaimsJws(token)
                    .getBody();
            String type = claims.get("type", String.class);
            return "refresh".equals(type);
        } catch (JwtException | IllegalArgumentException exception) {
            return false;
        }
    }
}
