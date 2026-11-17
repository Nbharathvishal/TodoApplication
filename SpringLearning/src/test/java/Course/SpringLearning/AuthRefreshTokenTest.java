package Course.SpringLearning;

import Course.SpringLearning.Controller.AuthController;
import Course.SpringLearning.Models.User;
import Course.SpringLearning.Repository.UserRepository;
import Course.SpringLearning.Service.UserSevice;
import Course.SpringLearning.utils.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.*;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;

public class AuthRefreshTokenTest {

    private AuthController authController;
    private JwtUtil jwtUtil;
    private FakeUserRepository userRepository;
    private PasswordEncoder passwordEncoder;

    static class FakeUserRepository implements UserRepository {
        private final Map<Long, User> storage = new HashMap<>();
        private final AtomicLong idGen = new AtomicLong(1);

        public User save(User user) {
            if (user.getId() == null) {
                user.setId(idGen.getAndIncrement());
            }
            storage.put(user.getId(), user);
            return user;
        }

        @Override
        public Optional<User> findByEmail(String email) {
            if (email == null) return Optional.empty();
            return storage.values().stream().filter(u -> email.equalsIgnoreCase(u.getEmail())).findFirst();
        }

        @Override
        public Optional<User> findByEmailIgnoreCase(String email) {
            return findByEmail(email);
        }

        @Override
        public <S extends User> List<S> saveAll(Iterable<S> entities) { return Collections.emptyList(); }
        @Override
        public Optional<User> findById(Long aLong) { return Optional.ofNullable(storage.get(aLong)); }
        @Override
        public boolean existsById(Long aLong) { return storage.containsKey(aLong); }
        @Override
        public List<User> findAll() { return new ArrayList<>(storage.values()); }
        @Override
        public List<User> findAllById(Iterable<Long> longs) { return Collections.emptyList(); }
        @Override
        public long count() { return storage.size(); }
        @Override
        public void deleteById(Long aLong) { storage.remove(aLong); }
        @Override
        public void delete(User entity) { storage.remove(entity.getId()); }
        @Override
        public void deleteAllById(Iterable<? extends Long> longs) {}
        @Override
        public void deleteAll(Iterable<? extends User> entities) {}
        @Override
        public void deleteAll() { storage.clear(); }
        @Override
        public List<User> findAll(org.springframework.data.domain.Sort sort) { return findAll(); }
        @Override
        public org.springframework.data.domain.Page<User> findAll(org.springframework.data.domain.Pageable pageable) { return org.springframework.data.domain.Page.empty(); }
        @Override
        public <S extends User> S saveAndFlush(S entity) { return (S) save(entity); }
        @Override
        public <S extends User> List<S> saveAllAndFlush(Iterable<S> entities) { return Collections.emptyList(); }
        @Override
        public void deleteAllInBatch(Iterable<User> entities) {}
        @Override
        public void deleteAllByIdInBatch(Iterable<Long> longs) {}
        @Override
        public void deleteAllInBatch() {}
        @Override
        public User getOne(Long aLong) { return storage.get(aLong); }
        @Override
        public User getById(Long aLong) { return storage.get(aLong); }
        @Override
        public User getReferenceById(Long aLong) { return storage.get(aLong); }
        @Override
        public <S extends User> Optional<S> findOne(org.springframework.data.domain.Example<S> example) { return Optional.empty(); }
        @Override
        public <S extends User> List<S> findAll(org.springframework.data.domain.Example<S> example) { return Collections.emptyList(); }
        @Override
        public <S extends User> List<S> findAll(org.springframework.data.domain.Example<S> example, org.springframework.data.domain.Sort sort) { return Collections.emptyList(); }
        @Override
        public <S extends User> org.springframework.data.domain.Page<S> findAll(org.springframework.data.domain.Example<S> example, org.springframework.data.domain.Pageable pageable) { return org.springframework.data.domain.Page.empty(); }
        @Override
        public <S extends User> long count(org.springframework.data.domain.Example<S> example) { return 0; }
        @Override
        public <S extends User> boolean exists(org.springframework.data.domain.Example<S> example) { return false; }
        @Override
        public <S extends User, R> R findBy(org.springframework.data.domain.Example<S> example, java.util.function.Function<org.springframework.data.repository.query.FluentQuery.FetchableFluentQuery<S>, R> queryFunction) { return null; }
        @Override
        public void flush() {}
    }

    @BeforeEach
    void setUp() {
        jwtUtil = new JwtUtil();
        userRepository = new FakeUserRepository();
        passwordEncoder = new BCryptPasswordEncoder();
        UserSevice userSevice = new UserSevice(userRepository, null);

        userRepository.save(User.builder()
                .id(1L)
                .email("testuser@example.com")
                .password(passwordEncoder.encode("Password123!"))
                .build());

        authController = new AuthController(userSevice, userRepository, passwordEncoder, jwtUtil);
    }

    @Test
    @DisplayName("1. Login returns both access token and refresh token")
    void testLoginReturnsTokens() {
        ResponseEntity<?> response = authController.loginUser(Map.of(
                "email", "testuser@example.com",
                "password", "Password123!"
        ));

        assertEquals(HttpStatus.OK, response.getStatusCode());
        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertNotNull(body);
        assertTrue(body.containsKey("token"));
        assertTrue(body.containsKey("refreshToken"));

        String token = (String) body.get("token");
        String refreshToken = (String) body.get("refreshToken");

        assertTrue(jwtUtil.validationToken(token));
        assertTrue(jwtUtil.validateRefreshToken(refreshToken));
        assertEquals("testuser@example.com", jwtUtil.extractEmail(token));
        assertEquals("testuser@example.com", jwtUtil.extractEmail(refreshToken));
    }

    @Test
    @DisplayName("2. /auth/refresh with valid refresh token generates new token pair")
    void testRefreshTokenSuccess() {
        String refreshToken = jwtUtil.generateRefreshToken("testuser@example.com");

        ResponseEntity<?> response = authController.refreshToken(Map.of("refreshToken", refreshToken));
        assertEquals(HttpStatus.OK, response.getStatusCode());

        Map<?, ?> body = (Map<?, ?>) response.getBody();
        assertNotNull(body);
        assertTrue(body.containsKey("token"));
        assertTrue(body.containsKey("refreshToken"));

        String newToken = (String) body.get("token");
        String newRefreshToken = (String) body.get("refreshToken");

        assertTrue(jwtUtil.validationToken(newToken));
        assertTrue(jwtUtil.validateRefreshToken(newRefreshToken));
        assertEquals("testuser@example.com", jwtUtil.extractEmail(newToken));
    }

    @Test
    @DisplayName("3. /auth/refresh with missing token returns 400 Bad Request")
    void testRefreshTokenMissing() {
        ResponseEntity<?> response = authController.refreshToken(Map.of());
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
    }

    @Test
    @DisplayName("4. /auth/refresh with invalid token returns 401 Unauthorized")
    void testRefreshTokenInvalid() {
        ResponseEntity<?> response = authController.refreshToken(Map.of("refreshToken", "not.a.valid.jwt"));
        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    @Test
    @DisplayName("5. Access token cannot be used at /auth/refresh -> Returns 401 Unauthorized")
    void testAccessTokenRejectedAtRefresh() {
        String accessToken = jwtUtil.generateAccessToken("testuser@example.com");

        ResponseEntity<?> response = authController.refreshToken(Map.of("refreshToken", accessToken));
        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }
}
