package Course.SpringLearning.Service;


import Course.SpringLearning.Models.Todo;
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
    public Todo createTodo(Todo todo){
        return todoRepository.save(todo);

    }


    //Getting all Todos

    public List<Todo> getAllTodos(){
        return todoRepository.findAll();
    }

     //Getting todo by id
    public Todo getTodoById( Long id){
        return todoRepository.findById(id).orElseThrow(() -> new RuntimeException("Todo Not Found"));
    }


    //Getting todo BY page

    public Page<Todo> getAllTodoPage(int page, int size){

        Pageable pageable= PageRequest.of(page,size);
        return todoRepository.findAll(pageable);
    }

    //Updating the Todo

    public Todo updateTodo(Todo todo){
        return todoRepository.save(todo);
    }

    //Delete All Todo

    public void  deleteTodoBYID(Long id){
        todoRepository.delete(getTodoById(id));
    }




}
