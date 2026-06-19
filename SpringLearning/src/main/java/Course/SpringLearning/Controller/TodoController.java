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
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new org.springframework.security.core.userdetails.UsernameNotFoundException("User not found: " + email));
    }

    //Getting all The Todos
    @GetMapping()
    ResponseEntity<List<Todo>> getTodo(){
        User user = getAuthenticatedUser();
        return new ResponseEntity<List<Todo>>(todoService.getAllTodosByUser(user), HttpStatus.OK);
    }

    // Getting Todo By Using the ID
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Todo Data Retrived Successfully"),
            @ApiResponse(responseCode = "404", description = "Todo Was Not Found")
    })
    @GetMapping("/{id}")
    ResponseEntity<Todo> getTodoById(@PathVariable long id) {
        try {
            User user = getAuthenticatedUser();
            Todo createdTodo = todoService.getTodoByIdAndUser(id, user);
            return new ResponseEntity<>(createdTodo, HttpStatus.OK);
        } catch (RuntimeException exception) {
            return new ResponseEntity<>(null, HttpStatus.NOT_FOUND);
        }
    }

    //Getting Page Todo
    @GetMapping("/page")
    ResponseEntity<Page<Todo>> getAllPage(@RequestParam int page, @RequestParam int size){
        User user = getAuthenticatedUser();
        return new ResponseEntity<>(todoService.getAllTodoPageByUser(user, page, size), HttpStatus.OK);
    }

    //Creating a new Todo
    @PostMapping("/create")
    ResponseEntity<Todo> createUser(@RequestBody Todo todo){
        User user = getAuthenticatedUser();
        return new ResponseEntity<>(todoService.createTodo(todo, user), HttpStatus.CREATED);
    }

    //Updating the Todo
    @PutMapping()
    ResponseEntity<Todo> updateTodo(@RequestBody Todo todo){
        User user = getAuthenticatedUser();
        return new ResponseEntity<>(todoService.updateTodo(todo, user), HttpStatus.OK);
    }

    //Delete Todo by Id
    @DeleteMapping("/{id}")
    void deleteById(@PathVariable Long id){
        User user = getAuthenticatedUser();
        todoService.deleteTodoByIdAndUser(id, user);
    }
}




