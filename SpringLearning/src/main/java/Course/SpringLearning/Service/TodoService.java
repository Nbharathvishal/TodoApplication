package Course.SpringLearning.Service;

import Course.SpringLearning.Models.Todo;
import Course.SpringLearning.Models.User;
import Course.SpringLearning.Repository.TodoRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class TodoService {

    @Autowired
    private TodoRepository todoRepository;

    //Creating Todos
    public Todo createTodo(Todo todo, User user){
        todo.setUser(user);
        return todoRepository.save(todo);
    }

    //Getting all Todos
    public List<Todo> getAllTodosByUser(User user){
        return todoRepository.findByUser(user);
    }

    //Getting todo by id with strict task ownership validation
    public Todo getTodoByIdAndUser(Long id, User user){
        if (id == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Todo ID cannot be null");
        }
        Optional<Todo> todoOpt = todoRepository.findById(id);
        if (todoOpt.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Todo Not Found");
        }
        Todo existing = todoOpt.get();
        if (existing.getUser() != null && user != null && existing.getUser().getId() != null && user.getId() != null) {
            if (!existing.getUser().getId().equals(user.getId())) {
                throw new AccessDeniedException("Access denied: You do not have permission to access or modify this task");
            }
        }
        return existing;
    }

    //Getting todo BY page
    public Page<Todo> getAllTodoPageByUser(User user, int page, int size){
        Pageable pageable = PageRequest.of(page, size);
        return todoRepository.findByUser(user, pageable);
    }

    //Updating the Todo
    public Todo updateTodo(Todo todo, User user){
        Todo existing = getTodoByIdAndUser(todo.getId(), user);
        if (todo.getTitle() != null && !todo.getTitle().trim().isEmpty()) {
            existing.setTitle(todo.getTitle());
        }
        if (todo.getDescription() != null) {
            existing.setDescription(todo.getDescription());
        }
        existing.setCompleted(todo.isCompleted());
        return todoRepository.save(existing);
    }

    //Updating completion status specifically
    public Todo updateTodoCompletion(Long id, boolean completed, User user){
        Todo existing = getTodoByIdAndUser(id, user);
        existing.setCompleted(completed);
        return todoRepository.save(existing);
    }

    //Partial update / patch
    public Todo patchTodo(Long id, Map<String, Object> updates, User user){
        Todo existing = getTodoByIdAndUser(id, user);
        if (updates != null) {
            if (updates.containsKey("completed")) {
                existing.setCompleted(Boolean.parseBoolean(String.valueOf(updates.get("completed"))));
            } else if (updates.containsKey("isCompleted")) {
                existing.setCompleted(Boolean.parseBoolean(String.valueOf(updates.get("isCompleted"))));
            }
            if (updates.containsKey("title") && updates.get("title") != null) {
                existing.setTitle(String.valueOf(updates.get("title")));
            }
            if (updates.containsKey("description") && updates.get("description") != null) {
                existing.setDescription(String.valueOf(updates.get("description")));
            }
        }
        return todoRepository.save(existing);
    }

    //Delete Todo
    public void deleteTodoByIdAndUser(Long id, User user){
        Todo todo = getTodoByIdAndUser(id, user);
        todoRepository.delete(todo);
    }
}
