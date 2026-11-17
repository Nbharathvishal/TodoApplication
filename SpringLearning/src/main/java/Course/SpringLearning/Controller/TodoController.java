package Course.SpringLearning.Controller;

import Course.SpringLearning.Models.Todo;
import Course.SpringLearning.Models.User;
import Course.SpringLearning.Repository.UserRepository;
import Course.SpringLearning.Service.TodoService;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;

@RestController()
@RequestMapping("/api/todo")
@Slf4j
public class TodoController {

    @Autowired
    private TodoService todoService;

    @Autowired
    private UserRepository userRepository;

    private User getAuthenticatedUser() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByEmailIgnoreCase(email != null ? email.trim() : "")
                .or(() -> userRepository.findByEmail(email))
                .orElseThrow(() -> new org.springframework.security.core.userdetails.UsernameNotFoundException("User not found: " + email));
    }

    //Getting all The Todos
    @GetMapping()
    public ResponseEntity<List<Todo>> getTodo(){
        User user = getAuthenticatedUser();
        return new ResponseEntity<List<Todo>>(todoService.getAllTodosByUser(user), HttpStatus.OK);
    }

    // Getting Todo By Using the ID
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Todo Data Retrived Successfully"),
            @ApiResponse(responseCode = "404", description = "Todo Was Not Found")
    })
    @GetMapping("/{id}")
    public ResponseEntity<Todo> getTodoById(@PathVariable long id) {
        User user = getAuthenticatedUser();
        Todo createdTodo = todoService.getTodoByIdAndUser(id, user);
        return new ResponseEntity<>(createdTodo, HttpStatus.OK);
    }

    //Getting Page Todo
    @GetMapping("/page")
    public ResponseEntity<Page<Todo>> getAllPage(@RequestParam int page, @RequestParam int size){
        User user = getAuthenticatedUser();
        return new ResponseEntity<>(todoService.getAllTodoPageByUser(user, page, size), HttpStatus.OK);
    }

    //Creating a new Todo
    @PostMapping("/create")
    public ResponseEntity<Todo> createUser(@RequestBody Todo todo){
        User user = getAuthenticatedUser();
        return new ResponseEntity<>(todoService.createTodo(todo, user), HttpStatus.CREATED);
    }

    //Updating the Todo
    @PutMapping()
    public ResponseEntity<Todo> updateTodo(@RequestBody Todo todo){
        User user = getAuthenticatedUser();
        return new ResponseEntity<>(todoService.updateTodo(todo, user), HttpStatus.OK);
    }

    //Updating the Todo by Path ID
    @PutMapping("/{id}")
    public ResponseEntity<Todo> updateTodoById(@PathVariable Long id, @RequestBody Todo todo){
        User user = getAuthenticatedUser();
        todo.setId(id);
        return new ResponseEntity<>(todoService.updateTodo(todo, user), HttpStatus.OK);
    }

    //Marking task as Completed / Updating status directly
    @PatchMapping("/{id}/complete")
    public ResponseEntity<Todo> completeTodo(@PathVariable Long id, @RequestBody(required = false) Map<String, Object> body){
        User user = getAuthenticatedUser();
        boolean completed = true;
        if (body != null && body.containsKey("completed")) {
            completed = Boolean.parseBoolean(String.valueOf(body.get("completed")));
        } else if (body != null && body.containsKey("isCompleted")) {
            completed = Boolean.parseBoolean(String.valueOf(body.get("isCompleted")));
        }
        return new ResponseEntity<>(todoService.updateTodoCompletion(id, completed, user), HttpStatus.OK);
    }

    @PutMapping("/{id}/complete")
    public ResponseEntity<Todo> completeTodoPut(@PathVariable Long id, @RequestBody(required = false) Map<String, Object> body){
        return completeTodo(id, body);
    }

    @PatchMapping("/{id}")
    public ResponseEntity<Todo> patchTodoById(@PathVariable Long id, @RequestBody Map<String, Object> body){
        User user = getAuthenticatedUser();
        return new ResponseEntity<>(todoService.patchTodo(id, body, user), HttpStatus.OK);
    }

    //Delete Todo by Id
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteById(@PathVariable Long id){
        User user = getAuthenticatedUser();
        todoService.deleteTodoByIdAndUser(id, user);
        return new ResponseEntity<>(HttpStatus.NO_CONTENT);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<String> handleAccessDenied(AccessDeniedException ex) {
        log.warn("Access denied on todo operation: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ex.getMessage());
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<String> handleResponseStatus(ResponseStatusException ex) {
        log.warn("ResponseStatusException on todo operation: {} - {}", ex.getStatusCode(), ex.getReason());
        return ResponseEntity.status(ex.getStatusCode()).body(ex.getReason());
    }
}
