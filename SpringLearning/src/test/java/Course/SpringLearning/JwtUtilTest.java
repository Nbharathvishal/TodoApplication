package Course.SpringLearning;

import Course.SpringLearning.utils.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class JwtUtilTest {

    private JwtUtil jwtUtil;

    @BeforeEach
    void setUp() {
        jwtUtil = new JwtUtil();
    }

    @Test
    void testGenerateAndValidateToken() {
        String email = "testuser@example.com";
        String token = jwtUtil.generateToken(email);

        assertNotNull(token);
        assertTrue(jwtUtil.validationToken(token));
        assertEquals(email, jwtUtil.extractEmail(token));
    }

    @Test
    void testValidateInvalidToken() {
        assertFalse(jwtUtil.validationToken("invalid.token.string"));
    }

    @Test
    void testGenerateAndValidateRefreshToken() {
        String email = "refreshuser@example.com";
        String refreshToken = jwtUtil.generateRefreshToken(email);

        assertNotNull(refreshToken);
        assertTrue(jwtUtil.validateRefreshToken(refreshToken));
        assertEquals(email, jwtUtil.extractEmail(refreshToken));
        // Refresh token must NOT validate as access token
        assertFalse(jwtUtil.validationToken(refreshToken));
    }

    @Test
    void testAccessTokenCannotBeUsedAsRefreshToken() {
        String email = "accessuser@example.com";
        String accessToken = jwtUtil.generateAccessToken(email);

        assertTrue(jwtUtil.validationToken(accessToken));
        assertFalse(jwtUtil.validateRefreshToken(accessToken));
    }
}
