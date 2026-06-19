package Course.SpringLearning.Service;

import Course.SpringLearning.Models.Todo;
import Course.SpringLearning.Models.User;
import Course.SpringLearning.Repository.TodoRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

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

    //Getting todo by id
    public Todo getTodoByIdAndUser(Long id, User user){
        return todoRepository.findByIdAndUser(id, user).orElseThrow(() -> new RuntimeException("Todo Not Found"));
    }

    //Getting todo BY page
    public Page<Todo> getAllTodoPageByUser(User user, int page, int size){
        Pageable pageable = PageRequest.of(page, size);
        return todoRepository.findByUser(user, pageable);
    }

    //Updating the Todo
    public Todo updateTodo(Todo todo, User user){
        Todo existing = getTodoByIdAndUser(todo.getId(), user);
        existing.setTitle(todo.getTitle());
        existing.setDescription(todo.getDescription());
        existing.setCompleted(todo.isCompleted());
        return todoRepository.save(existing);
    }

    //Delete Todo
    public void deleteTodoByIdAndUser(Long id, User user){
        Todo todo = getTodoByIdAndUser(id, user);
        todoRepository.delete(todo);
    }
}
