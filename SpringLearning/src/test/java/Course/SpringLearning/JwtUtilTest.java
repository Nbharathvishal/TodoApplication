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
}
