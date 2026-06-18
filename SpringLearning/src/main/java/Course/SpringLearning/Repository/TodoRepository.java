package Course.SpringLearning.Repository;

import Course.SpringLearning.Models.Todo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Component;


@Component
public interface TodoRepository extends JpaRepository<Todo ,Long> {


 }
