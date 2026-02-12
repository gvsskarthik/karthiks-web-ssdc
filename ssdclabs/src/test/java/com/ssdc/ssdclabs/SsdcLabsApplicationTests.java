package com.ssdc.ssdclabs;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
	"spring.datasource.url=jdbc:h2:mem:ssdclabs-test;MODE=MySQL;DB_CLOSE_DELAY=-1",
	"spring.datasource.driverClassName=org.h2.Driver",
	"spring.datasource.username=sa",
	"spring.datasource.password=",
	"spring.jpa.hibernate.ddl-auto=create-drop",
	"spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect",
	"app.jwt.secret=0123456789abcdef0123456789abcdef"
})
class SsdcLabsApplicationTests {

	@Test
	void contextLoads() {
	}

}
