package Course.SpringLearning;

import Course.SpringLearning.Controller.AuthController;
import Course.SpringLearning.Models.User;
import Course.SpringLearning.Repository.UserRepository;
import Course.SpringLearning.Service.UserSevice;
import Course.SpringLearning.utils.JwtUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Example;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.repository.query.FluentQuery;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Function;

import static org.junit.jupiter.api.Assertions.*;

public class AuthMismatchInvestigationTest {

    private AuthController authController;
    private InMemoryUserRepository fakeRepo;
    private InMemoryTodoRepository fakeTodoRepo;
    private PasswordEncoder passwordEncoder;
    private JwtUtil jwtUtil;

    static class InMemoryTodoRepository implements Course.SpringLearning.Repository.TodoRepository {
        private final Map<Long, Course.SpringLearning.Models.Todo> storage = new HashMap<>();
        private final AtomicLong idGen = new AtomicLong(1);

        @Override
        public List<Course.SpringLearning.Models.Todo> findByUser(User user) {
            if (user == null) return List.of();
            return storage.values().stream()
                    .filter(t -> t.getUser() != null && Objects.equals(t.getUser().getId(), user.getId()))
                    .toList();
        }

        @Override
        public Optional<Course.SpringLearning.Models.Todo> findByIdAndUser(Long id, User user) {
            return storage.values().stream()
                    .filter(t -> Objects.equals(t.getId(), id) && t.getUser() != null && Objects.equals(t.getUser().getId(), user.getId()))
                    .findFirst();
        }

        @Override
        public Page<Course.SpringLearning.Models.Todo> findByUser(User user, Pageable pageable) {
            return Page.empty();
        }

        @Override
        public void deleteByUser(User user) {
            if (user == null) return;
            storage.values().removeIf(t -> t.getUser() != null && Objects.equals(t.getUser().getId(), user.getId()));
        }

        @Override
        public <S extends Course.SpringLearning.Models.Todo> S save(S entity) {
            if (entity.getId() == null) entity.setId(idGen.getAndIncrement());
            storage.put(entity.getId(), entity);
            return entity;
        }

        @Override public Optional<Course.SpringLearning.Models.Todo> findById(Long id) { return Optional.ofNullable(storage.get(id)); }
        @Override public boolean existsById(Long id) { return storage.containsKey(id); }
        @Override public List<Course.SpringLearning.Models.Todo> findAll() { return new ArrayList<>(storage.values()); }
        @Override public List<Course.SpringLearning.Models.Todo> findAllById(Iterable<Long> longs) { return List.of(); }
        @Override public long count() { return storage.size(); }
        @Override public void deleteById(Long id) { storage.remove(id); }
        @Override public void delete(Course.SpringLearning.Models.Todo entity) { if (entity != null) storage.remove(entity.getId()); }
        @Override public void deleteAllById(Iterable<? extends Long> longs) {}
        @Override public void deleteAll(Iterable<? extends Course.SpringLearning.Models.Todo> entities) { if (entities != null) entities.forEach(this::delete); }
        @Override public void deleteAll() { storage.clear(); }
        @Override public void flush() {}
        @Override public <S extends Course.SpringLearning.Models.Todo> S saveAndFlush(S entity) { return save(entity); }
        @Override public <S extends Course.SpringLearning.Models.Todo> List<S> saveAllAndFlush(Iterable<S> entities) { return List.of(); }
        @Override public void deleteAllInBatch(Iterable<Course.SpringLearning.Models.Todo> entities) {}
        @Override public void deleteAllByIdInBatch(Iterable<Long> longs) {}
        @Override public void deleteAllInBatch() {}
        @Override public Course.SpringLearning.Models.Todo getOne(Long id) { return storage.get(id); }
        @Override public Course.SpringLearning.Models.Todo getById(Long id) { return storage.get(id); }
        @Override public Course.SpringLearning.Models.Todo getReferenceById(Long id) { return storage.get(id); }
        @Override public <S extends Course.SpringLearning.Models.Todo> List<S> findAll(Example<S> example) { return List.of(); }
        @Override public <S extends Course.SpringLearning.Models.Todo> List<S> findAll(Example<S> example, Sort sort) { return List.of(); }
        @Override public <S extends Course.SpringLearning.Models.Todo> List<S> saveAll(Iterable<S> entities) { return List.of(); }
        @Override public List<Course.SpringLearning.Models.Todo> findAll(Sort sort) { return List.of(); }
        @Override public Page<Course.SpringLearning.Models.Todo> findAll(Pageable pageable) { return Page.empty(); }
        @Override public <S extends Course.SpringLearning.Models.Todo> Optional<S> findOne(Example<S> example) { return Optional.empty(); }
        @Override public <S extends Course.SpringLearning.Models.Todo> Page<S> findAll(Example<S> example, Pageable pageable) { return Page.empty(); }
        @Override public <S extends Course.SpringLearning.Models.Todo> long count(Example<S> example) { return 0; }
        @Override public <S extends Course.SpringLearning.Models.Todo> boolean exists(Example<S> example) { return false; }
        @Override public <S extends Course.SpringLearning.Models.Todo, R> R findBy(Example<S> example, Function<FluentQuery.FetchableFluentQuery<S>, R> queryFunction) { return null; }
    }

    static class InMemoryUserRepository implements UserRepository {
        private final Map<Long, User> storage = new HashMap<>();
        private final AtomicLong idGen = new AtomicLong(1);

        @Override
        public Optional<User> findByEmail(String email) {
            if (email == null) return Optional.empty();
            return storage.values().stream()
                    .filter(u -> email.equals(u.getEmail()))
                    .findFirst();
        }

        @Override
        public Optional<User> findByEmailIgnoreCase(String email) {
            if (email == null) return Optional.empty();
            return storage.values().stream()
                    .filter(u -> u.getEmail() != null && u.getEmail().equalsIgnoreCase(email))
                    .findFirst();
        }

        @Override
        public <S extends User> S save(S entity) {
            if (entity.getId() == null) {
                entity.setId(idGen.getAndIncrement());
            }
            storage.put(entity.getId(), entity);
            return entity;
        }

        @Override
        public Optional<User> findById(Long aLong) {
            return Optional.ofNullable(storage.get(aLong));
        }

        @Override public boolean existsById(Long aLong) { return storage.containsKey(aLong); }
        @Override public List<User> findAll() { return new ArrayList<>(storage.values()); }
        @Override public List<User> findAllById(Iterable<Long> longs) { return List.of(); }
        @Override public long count() { return storage.size(); }
        @Override public void deleteById(Long aLong) { storage.remove(aLong); }
        @Override public void delete(User entity) { storage.remove(entity.getId()); }
        @Override public void deleteAllById(Iterable<? extends Long> longs) {}
        @Override public void deleteAll(Iterable<? extends User> entities) {}
        @Override public void deleteAll() { storage.clear(); }
        @Override public void flush() {}
        @Override public <S extends User> S saveAndFlush(S entity) { return save(entity); }
        @Override public <S extends User> List<S> saveAllAndFlush(Iterable<S> entities) { return List.of(); }
        @Override public void deleteAllInBatch(Iterable<User> entities) {}
        @Override public void deleteAllByIdInBatch(Iterable<Long> longs) {}
        @Override public void deleteAllInBatch() {}
        @Override public User getOne(Long aLong) { return storage.get(aLong); }
        @Override public User getById(Long aLong) { return storage.get(aLong); }
        @Override public User getReferenceById(Long aLong) { return storage.get(aLong); }
        @Override public <S extends User> List<S> findAll(Example<S> example) { return List.of(); }
        @Override public <S extends User> List<S> findAll(Example<S> example, Sort sort) { return List.of(); }
        @Override public <S extends User> List<S> saveAll(Iterable<S> entities) { return List.of(); }
        @Override public List<User> findAll(Sort sort) { return List.of(); }
        @Override public Page<User> findAll(Pageable pageable) { return Page.empty(); }
        @Override public <S extends User> Optional<S> findOne(Example<S> example) { return Optional.empty(); }
        @Override public <S extends User> Page<S> findAll(Example<S> example, Pageable pageable) { return Page.empty(); }
        @Override public <S extends User> long count(Example<S> example) { return 0; }
        @Override public <S extends User> boolean exists(Example<S> example) { return false; }
        @Override public <S extends User, R> R findBy(Example<S> example, Function<FluentQuery.FetchableFluentQuery<S>, R> queryFunction) { return null; }
    }

    @BeforeEach
    void setUp() {
        fakeRepo = new InMemoryUserRepository();
        fakeTodoRepo = new InMemoryTodoRepository();
        passwordEncoder = new BCryptPasswordEncoder();
        jwtUtil = new JwtUtil();
        UserSevice userSevice = new UserSevice(fakeRepo, fakeTodoRepo);
        authController = new AuthController(userSevice, fakeRepo, passwordEncoder, jwtUtil);
    }

    @Test
    @DisplayName("Test 1: Register a new email - Account created successfully")
    void testRegisterNewEmailSuccess() {
        ResponseEntity<String> res = authController.registerUser(Map.of(
                "email", "vishalbharath566@gmail.com",
                "password", "secret123"
        ));
        assertEquals(HttpStatus.CREATED, res.getStatusCode());
        assertEquals("Successfully Created", res.getBody());

        // Verify stored in DB with BCrypt hash (not plaintext)
        Optional<User> savedOpt = fakeRepo.findByEmail("vishalbharath566@gmail.com");
        assertTrue(savedOpt.isPresent());
        assertTrue(savedOpt.get().getPassword().startsWith("$2a$"));
    }

    @Test
    @DisplayName("Test 2: Register the same email again - Duplicate email error")
    void testRegisterDuplicateEmailReturnsConflict() {
        authController.registerUser(Map.of("email", "vishalbharath566@gmail.com", "password", "secret123"));

        ResponseEntity<String> duplicateRes = authController.registerUser(Map.of(
                "email", "vishalbharath566@gmail.com",
                "password", "secret123"
        ));
        assertEquals(HttpStatus.CONFLICT, duplicateRes.getStatusCode());
        assertEquals("This email address is already registered. Please sign in.", duplicateRes.getBody());
    }

    @Test
    @DisplayName("Test 3: Login with registered email and correct password - Login successful")
    void testLoginSuccess() {
        authController.registerUser(Map.of("email", "vishalbharath566@gmail.com", "password", "secret123"));

        ResponseEntity<?> loginRes = authController.loginUser(Map.of(
                "email", "vishalbharath566@gmail.com",
                "password", "secret123"
        ));
        assertEquals(HttpStatus.OK, loginRes.getStatusCode());
        Map<?, ?> body = (Map<?, ?>) loginRes.getBody();
        assertNotNull(body);
        assertTrue(body.containsKey("token"));
        assertTrue(jwtUtil.validationToken((String) body.get("token")));
    }

    @Test
    @DisplayName("Test 4: Login with registered email and incorrect password - Authentication rejected")
    void testLoginIncorrectPassword() {
        authController.registerUser(Map.of("email", "vishalbharath566@gmail.com", "password", "secret123"));

        ResponseEntity<?> loginRes = authController.loginUser(Map.of(
                "email", "vishalbharath566@gmail.com",
                "password", "wrongpassword"
        ));
        assertEquals(HttpStatus.UNAUTHORIZED, loginRes.getStatusCode());
        assertEquals("Incorrect email or password.", loginRes.getBody());
    }

    @Test
    @DisplayName("Test 5: Login with an unregistered email - Account not found")
    void testLoginUnregisteredEmail() {
        ResponseEntity<?> loginRes = authController.loginUser(Map.of(
                "email", "notfound@gmail.com",
                "password", "secret123"
        ));
        assertEquals(HttpStatus.UNAUTHORIZED, loginRes.getStatusCode());
        assertEquals("No account found with this email address. Please register.", loginRes.getBody());
    }

    @Test
    @DisplayName("Test 6: Login with different email casing - Consistent email lookup")
    void testLoginEmailCasingInsensitive() {
        authController.registerUser(Map.of("email", "vishalbharath566@gmail.com", "password", "secret123"));

        ResponseEntity<?> loginRes = authController.loginUser(Map.of(
                "email", "VishalBharath566@GMAIL.COM",
                "password", "secret123"
        ));
        assertEquals(HttpStatus.OK, loginRes.getStatusCode());
        Map<?, ?> body = (Map<?, ?>) loginRes.getBody();
        assertNotNull(body);
        assertTrue(body.containsKey("token"));
    }

    @Test
    @DisplayName("Test 7: Login with leading/trailing spaces - Email normalized correctly")
    void testLoginEmailWhitespaceNormalized() {
        authController.registerUser(Map.of("email", "  vishalbharath566@gmail.com  ", "password", "secret123"));

        ResponseEntity<?> loginRes = authController.loginUser(Map.of(
                "email", "   vishalbharath566@gmail.com ",
                "password", "secret123"
        ));
        assertEquals(HttpStatus.OK, loginRes.getStatusCode());
    }

    @Test
    @DisplayName("Test 8: Legacy plaintext password upgrade - Verifies plaintext and upgrades to BCrypt")
    void testLegacyPlaintextPasswordUpgrade() {
        // Simulate a user record that was inserted in plaintext (e.g. earlier SQL import or manual seed)
        User legacyUser = User.builder()
                .email("legacy_user@gmail.com")
                .password("plainpassword123")
                .build();
        fakeRepo.save(legacyUser);

        // Login with correct plaintext password
        ResponseEntity<?> loginRes = authController.loginUser(Map.of(
                "email", "legacy_user@gmail.com",
                "password", "plainpassword123"
        ));
        assertEquals(HttpStatus.OK, loginRes.getStatusCode());

        // Verify password in DB was automatically upgraded to a secure BCrypt hash
        User updatedUser = fakeRepo.findByEmail("legacy_user@gmail.com").get();
        assertNotEquals("plainpassword123", updatedUser.getPassword());
        assertTrue(updatedUser.getPassword().startsWith("$2a$"));
        assertTrue(passwordEncoder.matches("plainpassword123", updatedUser.getPassword()));
    }

    @Test
    @DisplayName("Test 9: Ping endpoint")
    void testPing() {
        assertEquals("pong", authController.ping().getBody());
    }

    @Test
    @DisplayName("Test 10: Delete account - Unauthenticated returns 401")
    void testDeleteAccountUnauthorized() {
        org.springframework.mock.web.MockHttpServletRequest req = new org.springframework.mock.web.MockHttpServletRequest();
        ResponseEntity<?> res = authController.deleteAccount(req, Map.of("password", "secret123"));
        assertEquals(HttpStatus.UNAUTHORIZED, res.getStatusCode());
    }

    @Test
    @DisplayName("Test 11: Delete account - Wrong password returns 401")
    void testDeleteAccountWrongPassword() {
        authController.registerUser(Map.of("email", "delete_me@gmail.com", "password", "secret123"));
        String token = jwtUtil.generateToken("delete_me@gmail.com");

        org.springframework.mock.web.MockHttpServletRequest req = new org.springframework.mock.web.MockHttpServletRequest();
        req.addHeader("Authorization", "Bearer " + token);

        ResponseEntity<?> res = authController.deleteAccount(req, Map.of("password", "wrongpass"));
        assertEquals(HttpStatus.UNAUTHORIZED, res.getStatusCode());
        assertEquals("Incorrect password. Account deletion cancelled.", res.getBody());

        // Account must still exist
        assertTrue(fakeRepo.findByEmail("delete_me@gmail.com").isPresent());
    }

    @Test
    @DisplayName("Test 12: Delete account - Success removes user and user todos, leaves other users intact")
    void testDeleteAccountSuccess() {
        // Create user 1
        authController.registerUser(Map.of("email", "victim@gmail.com", "password", "secret123"));
        User user1 = fakeRepo.findByEmail("victim@gmail.com").get();
        fakeTodoRepo.save(new Course.SpringLearning.Models.Todo(null, "Victim Task 1", "Desc", false, user1));
        fakeTodoRepo.save(new Course.SpringLearning.Models.Todo(null, "Victim Task 2", "Desc", true, user1));

        // Create user 2 (should remain untouched)
        authController.registerUser(Map.of("email", "survivor@gmail.com", "password", "survivor123"));
        User user2 = fakeRepo.findByEmail("survivor@gmail.com").get();
        fakeTodoRepo.save(new Course.SpringLearning.Models.Todo(null, "Survivor Task", "Desc", false, user2));

        String token = jwtUtil.generateToken("victim@gmail.com");
        org.springframework.mock.web.MockHttpServletRequest req = new org.springframework.mock.web.MockHttpServletRequest();
        req.addHeader("Authorization", "Bearer " + token);

        ResponseEntity<?> res = authController.deleteAccount(req, Map.of("password", "secret123"));
        assertEquals(HttpStatus.OK, res.getStatusCode());

        // Verify victim user and victim todos are permanently deleted
        assertTrue(fakeRepo.findByEmail("victim@gmail.com").isEmpty());
        assertTrue(fakeTodoRepo.findByUser(user1).isEmpty());

        // Verify survivor user and survivor todos are completely untouched
        assertTrue(fakeRepo.findByEmail("survivor@gmail.com").isPresent());
        assertEquals(1, fakeTodoRepo.findByUser(user2).size());
    }
}
