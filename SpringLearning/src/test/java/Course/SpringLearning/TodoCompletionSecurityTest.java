package Course.SpringLearning;

import Course.SpringLearning.Controller.TodoController;
import Course.SpringLearning.Models.Todo;
import Course.SpringLearning.Models.User;
import Course.SpringLearning.Repository.TodoRepository;
import Course.SpringLearning.Repository.UserRepository;
import Course.SpringLearning.Service.TodoService;
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
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Function;

import static org.junit.jupiter.api.Assertions.*;

public class TodoCompletionSecurityTest {

    private TodoController todoController;
    private TodoService todoService;
    private FakeTodoRepository todoRepository;
    private FakeUserRepository userRepository;

    private User userA;
    private User userB;
    private Todo todoA;
    private Todo todoB;

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
            return storage.values().stream().filter(u -> email.equals(u.getEmail())).findFirst();
        }

        @Override
        public Optional<User> findByEmailIgnoreCase(String email) {
            if (email == null) return Optional.empty();
            return storage.values().stream().filter(u -> email.equalsIgnoreCase(u.getEmail())).findFirst();
        }

        @Override public void flush() {}
        @Override public <S extends User> S saveAndFlush(S entity) { return null; }
        @Override public <S extends User> List<S> saveAllAndFlush(Iterable<S> entities) { return null; }
        @Override public void deleteAllInBatch(Iterable<User> entities) {}
        @Override public void deleteAllByIdInBatch(Iterable<Long> longs) {}
        @Override public void deleteAllInBatch() {}
        @Override public User getOne(Long aLong) { return null; }
        @Override public User getById(Long aLong) { return null; }
        @Override public User getReferenceById(Long aLong) { return null; }
        @Override public <S extends User> Optional<S> findOne(Example<S> example) { return Optional.empty(); }
        @Override public <S extends User> List<S> findAll(Example<S> example) { return null; }
        @Override public <S extends User> List<S> findAll(Example<S> example, Sort sort) { return null; }
        @Override public <S extends User> Page<S> findAll(Example<S> example, Pageable pageable) { return null; }
        @Override public <S extends User> long count(Example<S> example) { return 0; }
        @Override public <S extends User> boolean exists(Example<S> example) { return false; }
        @Override public <S extends User, R> R findBy(Example<S> example, Function<FluentQuery.FetchableFluentQuery<S>, R> queryFunction) { return null; }
        @Override public <S extends User> List<S> saveAll(Iterable<S> entities) { return null; }
        @Override public Optional<User> findById(Long aLong) { return Optional.ofNullable(storage.get(aLong)); }
        @Override public boolean existsById(Long aLong) { return storage.containsKey(aLong); }
        @Override public List<User> findAll() { return new ArrayList<>(storage.values()); }
        @Override public List<User> findAllById(Iterable<Long> longs) { return null; }
        @Override public long count() { return storage.size(); }
        @Override public void deleteById(Long aLong) { storage.remove(aLong); }
        @Override public void delete(User entity) { if (entity != null) storage.remove(entity.getId()); }
        @Override public void deleteAllById(Iterable<? extends Long> longs) {}
        @Override public void deleteAll(Iterable<? extends User> entities) {}
        @Override public void deleteAll() { storage.clear(); }
        @Override public List<User> findAll(Sort sort) { return null; }
        @Override public Page<User> findAll(Pageable pageable) { return null; }
    }

    static class FakeTodoRepository implements TodoRepository {
        private final Map<Long, Todo> storage = new HashMap<>();
        private final AtomicLong idGen = new AtomicLong(1);

        @Override
        public Todo save(Todo todo) {
            if (todo.getId() == null) {
                todo.setId(idGen.getAndIncrement());
            }
            storage.put(todo.getId(), todo);
            return todo;
        }

        @Override
        public List<Todo> findByUser(User user) {
            if (user == null) return List.of();
            return storage.values().stream()
                    .filter(t -> t.getUser() != null && Objects.equals(t.getUser().getId(), user.getId()))
                    .toList();
        }

        @Override
        public Optional<Todo> findByIdAndUser(Long id, User user) {
            return storage.values().stream()
                    .filter(t -> Objects.equals(t.getId(), id) && t.getUser() != null && Objects.equals(t.getUser().getId(), user.getId()))
                    .findFirst();
        }

        @Override
        public Page<Todo> findByUser(User user, Pageable pageable) {
            return Page.empty();
        }

        @Override
        public void deleteByUser(User user) {
            if (user == null) return;
            storage.values().removeIf(t -> t.getUser() != null && Objects.equals(t.getUser().getId(), user.getId()));
        }

        @Override public Optional<Todo> findById(Long id) { return Optional.ofNullable(storage.get(id)); }
        @Override public boolean existsById(Long aLong) { return storage.containsKey(aLong); }
        @Override public List<Todo> findAll() { return new ArrayList<>(storage.values()); }
        @Override public List<Todo> findAllById(Iterable<Long> longs) { return null; }
        @Override public long count() { return storage.size(); }
        @Override public void deleteById(Long aLong) { storage.remove(aLong); }
        @Override public void delete(Todo entity) { if (entity != null) storage.remove(entity.getId()); }
        @Override public void deleteAllById(Iterable<? extends Long> longs) {}
        @Override public void deleteAll(Iterable<? extends Todo> entities) {}
        @Override public void deleteAll() { storage.clear(); }
        @Override public List<Todo> findAll(Sort sort) { return null; }
        @Override public Page<Todo> findAll(Pageable pageable) { return null; }
        @Override public void flush() {}
        @Override public <S extends Todo> S saveAndFlush(S entity) { return null; }
        @Override public <S extends Todo> List<S> saveAllAndFlush(Iterable<S> entities) { return null; }
        @Override public void deleteAllInBatch(Iterable<Todo> entities) {}
        @Override public void deleteAllByIdInBatch(Iterable<Long> longs) {}
        @Override public void deleteAllInBatch() {}
        @Override public Todo getOne(Long aLong) { return null; }
        @Override public Todo getById(Long aLong) { return null; }
        @Override public Todo getReferenceById(Long aLong) { return null; }
        @Override public <S extends Todo> Optional<S> findOne(Example<S> example) { return Optional.empty(); }
        @Override public <S extends Todo> List<S> findAll(Example<S> example) { return null; }
        @Override public <S extends Todo> List<S> findAll(Example<S> example, Sort sort) { return null; }
        @Override public <S extends Todo> Page<S> findAll(Example<S> example, Pageable pageable) { return null; }
        @Override public <S extends Todo> long count(Example<S> example) { return 0; }
        @Override public <S extends Todo> boolean exists(Example<S> example) { return false; }
        @Override public <S extends Todo, R> R findBy(Example<S> example, Function<FluentQuery.FetchableFluentQuery<S>, R> queryFunction) { return null; }
        @Override public <S extends Todo> List<S> saveAll(Iterable<S> entities) { return null; }
    }

    @BeforeEach
    void setUp() {
        userRepository = new FakeUserRepository();
        todoRepository = new FakeTodoRepository();

        userA = userRepository.save(User.builder().email("userA@example.com").password("passA").build());
        userB = userRepository.save(User.builder().email("userB@example.com").password("passB").build());

        todoService = new TodoService();
        ReflectionTestUtils.setField(todoService, "todoRepository", todoRepository);

        todoController = new TodoController();
        ReflectionTestUtils.setField(todoController, "todoService", todoService);
        ReflectionTestUtils.setField(todoController, "userRepository", userRepository);

        todoA = todoService.createTodo(new Todo(null, "Task A", "Description A", false, null), userA);
        todoB = todoService.createTodo(new Todo(null, "Task B", "Description B", false, null), userB);

        // Default authenticate as User A
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(userA.getEmail(), null, List.of())
        );
    }

    @Test
    @DisplayName("1. Valid user marks task as Completed -> Returns 200 and updates DB")
    void testMarkTaskAsCompleted() {
        Todo updatePayload = new Todo(todoA.getId(), "Task A", "Description A", true, null);
        ResponseEntity<Todo> response = todoController.updateTodo(updatePayload);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertTrue(response.getBody().isCompleted());

        // Verify in database
        Todo inDb = todoRepository.findById(todoA.getId()).orElseThrow();
        assertTrue(inDb.isCompleted(), "Task completion status must be true in DB");
    }

    @Test
    @DisplayName("2. Valid user marks Completed task as Pending again -> Returns 200 and updates DB")
    void testMarkCompletedTaskAsPending() {
        // First mark completed
        todoA.setCompleted(true);
        todoRepository.save(todoA);

        // Reopen to pending
        Todo updatePayload = new Todo(todoA.getId(), "Task A", "Description A", false, null);
        ResponseEntity<Todo> response = todoController.updateTodo(updatePayload);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertFalse(response.getBody().isCompleted());

        // Verify in database
        Todo inDb = todoRepository.findById(todoA.getId()).orElseThrow();
        assertFalse(inDb.isCompleted(), "Task completion status must be false in DB");
    }

    @Test
    @DisplayName("3. Valid user updates another task field (title/desc) -> Returns 200")
    void testUpdateAnotherTask() {
        Todo updatePayload = new Todo(todoA.getId(), "Updated Task A Title", "Updated Description", false, null);
        ResponseEntity<Todo> response = todoController.updateTodo(updatePayload);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("Updated Task A Title", response.getBody().getTitle());
        assertEquals("Updated Description", response.getBody().getDescription());

        Todo inDb = todoRepository.findById(todoA.getId()).orElseThrow();
        assertEquals("Updated Task A Title", inDb.getTitle());
    }

    @Test
    @DisplayName("4. Test completion via PATCH /complete and PUT /complete endpoints -> Returns 200")
    void testCompleteEndpointVariants() {
        ResponseEntity<Todo> patchRes = todoController.completeTodo(todoA.getId(), Map.of("completed", true));
        assertEquals(HttpStatus.OK, patchRes.getStatusCode());
        assertTrue(patchRes.getBody().isCompleted());

        ResponseEntity<Todo> putRes = todoController.completeTodoPut(todoA.getId(), Map.of("completed", false));
        assertEquals(HttpStatus.OK, putRes.getStatusCode());
        assertFalse(putRes.getBody().isCompleted());
    }

    @Test
    @DisplayName("5. Access to another user's task -> Returns 403 Forbidden with permission error")
    void testAccessAnotherUserTaskReturns403() {
        // Authenticated as User A, trying to mark User B's task completed
        Todo maliciousPayload = new Todo(todoB.getId(), "Hijacked Task B", "Desc", true, null);

        AccessDeniedException ex = assertThrows(AccessDeniedException.class, () -> {
            todoController.updateTodo(maliciousPayload);
        });

        assertTrue(ex.getMessage().contains("Access denied"));

        // Test exception handler returns 403 Forbidden
        ResponseEntity<String> errorResponse = todoController.handleAccessDenied(ex);
        assertEquals(HttpStatus.FORBIDDEN, errorResponse.getStatusCode());
        assertTrue(errorResponse.getBody().contains("Access denied"));

        // Verify User B's task was NOT modified in the database
        Todo unchangedTodoB = todoRepository.findById(todoB.getId()).orElseThrow();
        assertFalse(unchangedTodoB.isCompleted(), "User B's task must not be completed by User A");
    }

    @Test
    @DisplayName("6. Non-existent task ID -> Returns 404 Not Found")
    void testNonExistentTaskReturns404() {
        Todo nonExistentPayload = new Todo(99999L, "Nonexistent", "Desc", true, null);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> {
            todoController.updateTodo(nonExistentPayload);
        });

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
        ResponseEntity<String> errorResponse = todoController.handleResponseStatus(ex);
        assertEquals(HttpStatus.NOT_FOUND, errorResponse.getStatusCode());
    }

    @Test
    @DisplayName("7. Expired or unauthenticated session -> Throws UsernameNotFoundException")
    void testUnauthenticatedSession() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("ghost_user@example.com", null, List.of())
        );

        Todo payload = new Todo(todoA.getId(), "Task A", "Desc", true, null);
        assertThrows(org.springframework.security.core.userdetails.UsernameNotFoundException.class, () -> {
            todoController.updateTodo(payload);
        });
    }
}
