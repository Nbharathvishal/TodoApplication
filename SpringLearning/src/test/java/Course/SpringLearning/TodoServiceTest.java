package Course.SpringLearning;

import Course.SpringLearning.Models.Todo;
import Course.SpringLearning.Models.User;
import Course.SpringLearning.Repository.TodoRepository;
import Course.SpringLearning.Service.TodoService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TodoServiceTest {

    @Mock
    private TodoRepository todoRepository;

    @InjectMocks
    private TodoService todoService;

    private User testUser;
    private Todo testTodo;

    @BeforeEach
    void setUp() {
        testUser = User.builder().id(1L).email("user@test.com").password("pass123").build();
        testTodo = new Todo(1L, "Test Title", "Test Desc", false, testUser);
    }

    @Test
    void testCreateTodo() {
        when(todoRepository.save(any(Todo.class))).thenReturn(testTodo);

        Todo created = todoService.createTodo(testTodo, testUser);

        assertNotNull(created);
        assertEquals("Test Title", created.getTitle());
        assertEquals(testUser, created.getUser());
        verify(todoRepository, times(1)).save(testTodo);
    }

    @Test
    void testGetAllTodosByUser() {
        when(todoRepository.findByUser(testUser)).thenReturn(List.of(testTodo));

        List<Todo> todos = todoService.getAllTodosByUser(testUser);

        assertEquals(1, todos.size());
        assertEquals("Test Title", todos.get(0).getTitle());
        verify(todoRepository, times(1)).findByUser(testUser);
    }

    @Test
    void testGetTodoByIdAndUser_Success() {
        when(todoRepository.findByIdAndUser(1L, testUser)).thenReturn(Optional.of(testTodo));

        Todo found = todoService.getTodoByIdAndUser(1L, testUser);

        assertNotNull(found);
        assertEquals(1L, found.getId());
    }

    @Test
    void testGetTodoByIdAndUser_NotFound() {
        when(todoRepository.findByIdAndUser(99L, testUser)).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> todoService.getTodoByIdAndUser(99L, testUser));
    }

    @Test
    void testUpdateTodo() {
        when(todoRepository.findByIdAndUser(1L, testUser)).thenReturn(Optional.of(testTodo));
        when(todoRepository.save(any(Todo.class))).thenReturn(testTodo);

        Todo updatedInput = new Todo(1L, "Updated Title", "Updated Desc", true, testUser);
        Todo result = todoService.updateTodo(updatedInput, testUser);

        assertNotNull(result);
        assertEquals("Updated Title", result.getTitle());
        assertTrue(result.isCompleted());
    }

    @Test
    void testDeleteTodoByIdAndUser() {
        when(todoRepository.findByIdAndUser(1L, testUser)).thenReturn(Optional.of(testTodo));
        doNothing().when(todoRepository).delete(testTodo);

        todoService.deleteTodoByIdAndUser(1L, testUser);

        verify(todoRepository, times(1)).delete(testTodo);
    }

    @Test
    void testGetAllTodoPageByUser() {
        Page<Todo> page = new PageImpl<>(List.of(testTodo));
        when(todoRepository.findByUser(eq(testUser), any(PageRequest.class))).thenReturn(page);

        Page<Todo> result = todoService.getAllTodoPageByUser(testUser, 0, 10);

        assertEquals(1, result.getTotalElements());
    }
}
